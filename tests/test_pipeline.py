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

    def test_rejected_batch_does_not_replace_published_data(self):
        with tempfile.TemporaryDirectory() as directory:
            base=Path(directory);out=base/'saida';out.mkdir()
            (out/'pontos.geojson').write_text('previous',encoding='utf-8')
            (base/'bad.csv').write_text('ID_URPV;NOME_URPV;GEOMETRIA\n1;Inválido;POINT(0 0)',encoding='utf-8')
            manifest={'fontes':[{'slug':'urpv','arquivo':'bad.csv','nome':'URPV','url':'https://dados.pbh.gov.br'}]}
            with self.assertRaises(ValueError):pipeline.processar(base,out,manifest)
            self.assertEqual((out/'pontos.geojson').read_text(encoding='utf-8'),'previous')


if __name__=='__main__':unittest.main()
