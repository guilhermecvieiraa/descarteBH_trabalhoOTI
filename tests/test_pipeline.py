import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pipeline


class PipelineTests(unittest.TestCase):
    def test_literal(self):
        self.assertEqual(pipeline.materiais_literal('METAL, PAPÉIS E PLÁSTICOS'), ['papel', 'plastico', 'metal'])
        self.assertEqual(pipeline.materiais_literal('URPV'), [])
        self.assertNotIn('colchao',pipeline.materiais_literal('MÓVEIS INSERVÍVEIS'))

    def test_coordinates(self):
        lon,lat=pipeline.para_point('POINT (611411.82 7807916.51)')
        self.assertTrue(-44<lon<-43 and -20<lat<-19)
        for text in ['', 'INVALID', 'LINESTRING(0 0, 1 1)', 'POINT(0 0)']:
            with self.assertRaises(ValueError):pipeline.para_point(text)

    def test_source_not_equivalent_to_type_and_exact_duplicates(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory)
            fields=['ID_URPV','NOME_URPV','GEOMETRIA','TIPO_MATERIAL_COLETADO']
            for filename in ['ponto_verde.csv','urpv.csv']:
                with (base/filename).open('w',encoding='utf-8',newline='') as stream:
                    writer=csv.writer(stream,delimiter=';');writer.writerow(fields)
                    writer.writerow(['1','URPV exemplo','POINT (611411.82 7807916.51)','ENTULHO'])
                    writer.writerow(['2','Inválido','POINT (0 0)',''])
            manifest={'fontes':[{'slug':s,'arquivo':s+'.csv','url':'https://dados.pbh.gov.br','nome':s} for s in ['ponto_verde','urpv']]}
            with patch.object(pipeline,'BASE',base):report=pipeline.processar(base,base/'saida',manifest)
            features=json.loads((base/'saida/pontos.geojson').read_text(encoding='utf-8'))['features']
            self.assertEqual(len(features),1)
            self.assertEqual(features[0]['properties']['tipo'],'urpv')
            self.assertEqual(len(features[0]['properties']['origens']),2)
            self.assertEqual(len(report['duplicados_integrados']),1)
            self.assertEqual(len(report['registros_rejeitados']),2)
            self.assertIsNone(report['fontes'][0].get('baixado_em'))

    def test_galpao_mapping_preserves_association_materials_and_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            source_file = base / "20261103_galpao_reciclagem.csv"
            headers = [
                "ID_GALPAO_RECICLAGEM", "NOME_GALPAO_RECICLAGEM",
                "NOME_ASSOCIACAO_COOPERATIVA", "TIPO_RESIDUOS",
                "TIPO_LOGRADOURO", "NOME_LOGRADOURO", "NUM_IMOVEL",
                "NOME_BAIRRO_POPULAR", "HORARIO_FUNCIONAMENTO", "GEOMETRIA",
            ]
            with source_file.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.writer(stream, delimiter=";")
                writer.writerow(headers)
                writer.writerow([
                    "1", "ITUIUTABA", "ASMARE", "ISOPOR,METAL,PAPEL,PLÁSTICO,VIDRO",
                    "RUA", "ITUIUTABA", "460", "PRADO", "SEGUNDA A SEXTA, DAS 9H ÀS 16H",
                    "POINT (608697.00 7797140.28)",
                ])
            manifest = {"fontes": [{
                "slug": "galpao", "tipo": "galpao", "arquivo": source_file.name,
                "nome": "Galpão de Reciclagem", "url": "https://dados.pbh.gov.br/dataset/galpao-reciclagem",
                "data_referencia": "2026-11-03",
                "mapeamento": {
                    "id": "ID_GALPAO_RECICLAGEM", "nome": "NOME_GALPAO_RECICLAGEM",
                    "associacao": "NOME_ASSOCIACAO_COOPERATIVA", "material": "TIPO_RESIDUOS",
                    "horario": "HORARIO_FUNCIONAMENTO", "tipo_logradouro": "TIPO_LOGRADOURO",
                    "logradouro": "NOME_LOGRADOURO", "numero": "NUM_IMOVEL",
                    "bairro": "NOME_BAIRRO_POPULAR", "geometria": "GEOMETRIA",
                },
            }]}
            output = base / "dist" / "dados"
            with patch.object(pipeline, "BASE", base):
                report = pipeline.processar(base, output, manifest)

            geo = json.loads((output / "pontos.geojson").read_text(encoding="utf-8"))
            feature = geo["features"][0]
            properties = feature["properties"]
            metadata = json.loads((output / "metadados.json").read_text(encoding="utf-8"))
            self.assertEqual(properties["tipo"], "galpao")
            self.assertEqual(properties["associacao_cooperativa"], "ASMARE")
            self.assertEqual(properties["materiais_indexados"], ["papel", "plastico", "metal", "vidro", "isopor"])
            self.assertEqual(properties["origens"][0]["arquivo"], source_file.name)
            self.assertEqual(report["quantidade_total"], 1)
            self.assertEqual(report["rejeicoes"], {})
            self.assertIn("associacao_cooperativa", metadata["campos"])

    def test_rejected_batch_does_not_replace_published_data(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);out=base/'saida';out.mkdir()
            (out/'pontos.geojson').write_text('previous',encoding='utf-8')
            (base/'bad.csv').write_text('ID_URPV;NOME_URPV;GEOMETRIA\n1;Inválido;POINT(0 0)',encoding='utf-8')
            manifest={'fontes':[{'slug':'urpv','arquivo':'bad.csv','nome':'URPV','url':'https://dados.pbh.gov.br'}]}
            with self.assertRaises(ValueError):pipeline.processar(base,out,manifest)
            self.assertEqual((out/'pontos.geojson').read_text(encoding='utf-8'),'previous')

    def test_formatacao_numero_imovel(self):
        self.assertEqual(pipeline.formatar_numero("945.0"), "945")
        self.assertEqual(pipeline.formatar_numero("2600.0"), "2600")
        self.assertEqual(pipeline.formatar_numero("S/N"), "S/N")
        self.assertEqual(pipeline.formatar_numero("12A"), "12A")


if __name__=='__main__':unittest.main()
