"""CSV oficiais preservados -> GeoJSON, CSV, metadados e auditoria do Descarte BH."""
import argparse
import csv
import hashlib
import io
import json
import math
import re
import shutil
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from pyproj import Transformer
from shapely import wkt
from shapely.geometry import Point

BASE = Path(__file__).resolve().parent
TRANSFORMER = Transformer.from_crs(31983, 4326, always_xy=True)
COMMON = {"material": "TIPO_MATERIAL_COLETADO", "horario": "HORARIO_FUNCIONAMENTO",
          "tipo_logradouro": "TIPO_LOGRADOURO", "logradouro": "NOME_LOGRADOURO",
          "numero": "NUMERO_IMOVEL", "letra": "LETRA_IMOVEL", "bairro": "BAIRRO",
          "regional": "REGIONAL", "referencia": "REF_LOCALIZACAO", "geometria": "GEOMETRIA"}
MATERIALS = {
    "papel": ("Papel e papelão", r"\b(?:papel|papeis|papelao)\b"),
    "plastico": ("Plástico", r"\bplasticos?\b"),
    "metal": ("Metal", r"\b(?:metal|metais|aluminio)\b"),
    "vidro": ("Vidro", r"\bvidros?\b"),
    "isopor": ("Isopor", r"\bisopor\b"),
    "entulho": ("Entulho", r"\bentulhos?\b"),
    "poda": ("Resíduos de poda", r"\bpodas?\b"),
    "terra": ("Terra", r"\bterra\b"),
    "pneu": ("Pneus", r"\bpneus?\b"),
    "colchao": ("Colchões", r"\bcolch(?:ao|oes)\b"),
    "madeira": ("Madeira", r"\bmadeiras?\b"),
    "moveis": ("Móveis", r"\b(?:movel|moveis|mobilia)\b"),
    "volumosos": ("Volumosos", r"\bvolumosos?\b"),
    "carcacas_eletrodomesticos": ("Carcaças de eletrodomésticos", r"\bcarcacas? de eletrodomesticos\b"),
}


def chave(value):
    text = unicodedata.normalize("NFD", str(value or "").strip().lower())
    return " ".join("".join(c for c in text if unicodedata.category(c) != "Mn").split())

def formatar_numero(texto):
    texto = texto.strip()
    resultado = re.fullmatch(r"(\d+)\.0+", texto)

    return resultado.group(1) if resultado else texto

def materiais_literal(text):
    return [key for key, (_, regex) in MATERIALS.items() if re.search(regex, chave(text))]


def ler_csv(path):
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            text = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    try:
        delimiter = csv.Sniffer().sniff(text[:8192], delimiters=";,\t").delimiter
    except csv.Error:
        delimiter = ";" if text[:8192].count(";") >= text[:8192].count(",") else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    headers = [(h or "").strip().lstrip("\ufeff") for h in reader.fieldnames or []]
    if len(headers) != len(set(headers)):
        raise ValueError(f"Cabeçalhos duplicados em {path.name}")
    reader.fieldnames = headers
    return headers, list(reader), encoding, delimiter


def para_point(text):
    if not text:
        raise ValueError("sem_geometria")
    try:
        point = wkt.loads(text)
    except Exception as exc:
        raise ValueError("geometria_invalida") from exc
    if not isinstance(point, Point) or point.is_empty:
        raise ValueError("geometria_nao_pontual")
    lon, lat = TRANSFORMER.transform(point.x, point.y)
    if not all(map(math.isfinite, (lon, lat))) or not (-45 <= lon <= -42 and -22 <= lat <= -18):
        raise ValueError("coordenada_fora_do_entorno_bh")
    return [round(lon, 7), round(lat, 7)]


def processar(entrada, saida, manifest):
    features, signatures, reports, rejections, duplicates = [], {}, [], [], []
    counts = Counter()
    timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    # Read/validate all inputs before publishing anything.
    for source in manifest["fontes"]:
        path = entrada / source["arquivo"]
        headers, rows, encoding, delimiter = ler_csv(path)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        source_report = {**source, "sha256": digest, "cabecalhos": headers,
                         "codificacao": encoding, "separador": delimiter,
                         "linhas_lidas": len(rows), "registros_aproveitados": 0,
                         "duplicados_integrados": 0, "registros_rejeitados": 0,
                         "esquemas_encontrados": [], "arquivo_bruto_url": f"brutos/{digest}.csv"}
        if "GEOMETRIA" not in headers and not source.get("mapeamento"):
            raise ValueError(f"{path.name}: falta GEOMETRIA")
        if source["slug"] == "galpao" and not source.get("mapeamento"):
            raise ValueError("Galpão exige mapeamento de colunas explicitamente validado em fontes.json")
        seen = set()
        for line, row in enumerate(rows, 2):
            try:
                if None in row or any(v is None for v in row.values()):
                    raise ValueError("quantidade_colunas_invalida")
                row = {k: v.strip() for k, v in row.items()}
                # Schema describes the record; origin remains the declared dataset.
                if row.get("ID_URPV"):
                    kind, id_field, name_field = "urpv", "ID_URPV", "NOME_URPV"
                elif row.get("ID_LEV"):
                    kind, id_field, name_field = "ponto_verde", "ID_LEV", "NOME_LEV"
                elif source.get("mapeamento"):
                    kind = source.get("tipo", source["slug"])
                    id_field, name_field = source["mapeamento"]["id"], source["mapeamento"]["nome"]
                else:
                    raise ValueError("identificador_ausente_ou_esquema_nao_reconhecido")
                if name_field not in headers:
                    raise ValueError("coluna_nome_ausente")
                identifier = row[id_field]
                if (kind, identifier) in seen:
                    raise ValueError("id_duplicado_na_fonte")
                cmap = {**COMMON, **source.get("mapeamento", {})}
                get = lambda k: row.get(cmap.get(k, ""), "")
                coords = para_point(get("geometria"))
                seen.add((kind, identifier))
                partes_endereco = [
                        get("tipo_logradouro"),
                        get("logradouro"),
                        formatar_numero(get("numero")),
                        get("letra")
                ]
                    
                address = " ".join(parte for parte in partes_endereco if parte)
                origin = {"fonte": source["slug"], "nome": source["nome"], "url": source["url"],
                          "recurso_url": source.get("recurso_url"), "arquivo": path.name,
                          "data_referencia": source.get("data_referencia"), "sha256": digest,
                          "linha": line, "id_registro": f"{source['slug']}:{kind}:{identifier}"}
                props = {"id": f"{source['slug']}:{kind}:{identifier}", "id_original": identifier,
                         "tipo": kind, "nome": row[name_field], "bairro": get("bairro"),
                         "regional": get("regional"), "endereco": address, "referencia": get("referencia"),
                         "horario_original": get("horario"), "material_original": get("material"),
                         "materiais_indexados": materiais_literal(get("material")),
                         "origem_url": source["url"], "origens": [origin]}
                # Merge only exact semantic duplicates, never different revisions/attributes.
                semantic = {k: v for k, v in props.items() if k not in ("id", "origem_url", "origens")}
                signature = json.dumps([semantic, coords], sort_keys=True, ensure_ascii=False)
                if signature in signatures:
                    target = signatures[signature]
                    target["properties"]["origens"].append(origin)
                    duplicates.append({"registro": origin["id_registro"], "integrado_em": target["properties"]["id"]})
                    source_report["duplicados_integrados"] += 1
                else:
                    feature = {"type": "Feature", "geometry": {"type": "Point", "coordinates": coords}, "properties": props}
                    features.append(feature)
                    signatures[signature] = feature
                    source_report["registros_aproveitados"] += 1
                if kind not in source_report["esquemas_encontrados"]:
                    source_report["esquemas_encontrados"].append(kind)
            except ValueError as exc:
                reason = str(exc)
                counts[f"{source['slug']}:{reason}"] += 1
                source_report["registros_rejeitados"] += 1
                rejections.append({"arquivo": path.name, "linha": line, "motivo": reason})
        reports.append(source_report)
    if not reports:
        raise ValueError("Nenhuma fonte configurada")
    if not features:
        raise ValueError("Nenhum ponto válido. A versão publicada não foi substituída.")
    features.sort(key=lambda f: (chave(f["properties"]["nome"]), f["properties"]["id"]))
    # Flag possible overlaps for manual review rather than silently dropping records.
    overlaps = []
    enderecos_compartilhados = []

    for i, a in enumerate(features):
        for b in features[i + 1:]:
            pa, pb = a["properties"], b["properties"]

            mesmas_coordenadas = a["geometry"] == b["geometry"]

            mesmo_endereco = (
                pa["endereco"]
                and chave(pa["endereco"]) == chave(pb["endereco"])
            )

            if mesmas_coordenadas:
                overlaps.append([pa["id"], pb["id"]])

            elif mesmo_endereco:
                enderecos_compartilhados.append([pa["id"], pb["id"]])
    report = {"processado_em_utc": timestamp, "quantidade_total": len(features), "fontes": reports,
              "rejeicoes": dict(counts), "registros_rejeitados": rejections,
              "duplicados_integrados": duplicates, "possiveis_sobreposicoes": overlaps,
              "enderecos_compartilhados": enderecos_compartilhados,
              "alerta": "Materiais indexados somente se citados no CSV. Confirme condições atuais com a PBH."}
    metadata = {"titulo": "Descarte BH — pontos de recebimento de resíduos", "criador": "Prefeitura de Belo Horizonte / fontes declaradas",
                "publicador": "Descarte BH — projeto acadêmico UFMG / OTI071", "idioma": "pt-BR",
                "cobertura": "Belo Horizonte, Minas Gerais, Brasil", "formato": "GeoJSON (RFC 7946)",
                "crs_origem": "EPSG:31983", "crs_saida": "EPSG:4326", "ordem_coordenadas": "longitude, latitude",
                "processado_em_utc": timestamp, "quantidade_total": len(features), "fontes": reports,
                "materiais": [{"id": k, "nome": v[0], "quantidade": sum(k in f["properties"]["materiais_indexados"] for f in features)} for k, v in MATERIALS.items()],
                "criterio_indexacao": "Correspondência literal normalizada, sem inferir materiais pelo tipo de equipamento.",
                "campos": {"id": "Identificador prefixado pela fonte de origem", "tipo": "Tipo identificado pelo esquema do registro, separado da origem",
                           "nome": "Nome original da unidade", "endereco": "Logradouro, número e letra da fonte",
                           "bairro": "Bairro informado", "regional": "Regional informada", "referencia": "Referência de localização original",
                           "material_original": "Descrição preservada dos materiais", "materiais_indexados": "Vocabulário literal para recuperação",
                           "horario_original": "Horário preservado, sem inferência de aberto agora", "origens": "Fonte, URL, arquivo, linha, referência temporal e SHA-256"},
                "limitacoes": ["Data do processamento não equivale à data de atualização da prefeitura.",
                               "URL específica do recurso e data de download permanecem não informadas quando desconhecidas.",
                               "Ausência no índice não comprova proibição. Confirme a aceitação com a PBH.",
                               "Galpões só entram após fornecimento do CSV e validação explícita do mapeamento."]}
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "brutos").mkdir(exist_ok=True)
    for source in reports:
        target = saida / source["arquivo_bruto_url"]
        if not target.exists():
            shutil.copyfile(entrada / source["arquivo"], target)
    outputs = {"pontos.geojson": {"type": "FeatureCollection", "features": features},
               "metadados.json": metadata, "relatorio_qualidade.json": report}
    for name, payload in outputs.items():
        temp = saida / (name + ".tmp")
        temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        temp.replace(saida / name)
    csv_rows = [{**{k: v for k, v in f["properties"].items() if k != "origens"},
                 "origens": json.dumps(f["properties"]["origens"], ensure_ascii=False),
                 "materiais_indexados": "|".join(f["properties"]["materiais_indexados"]),
                 "longitude": f["geometry"]["coordinates"][0], "latitude": f["geometry"]["coordinates"][1]} for f in features]
    with (saida / "pontos.csv").open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(csv_rows[0]))
        writer.writeheader()
        writer.writerows(csv_rows)
    history = BASE / "historico" / timestamp.replace(":", "-")
    history.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(saida / "metadados.json", history / "metadados.json")
    shutil.copyfile(saida / "relatorio_qualidade.json", history / "relatorio_qualidade.json")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entrada", type=Path, default=BASE / "dados_brutos")
    parser.add_argument("--saida", type=Path, default=BASE / "dist" / "dados")
    parser.add_argument("--fontes", type=Path, default=BASE / "fontes.json")
    args = parser.parse_args()
    result = processar(args.entrada, args.saida, json.loads(args.fontes.read_text(encoding="utf-8")))
    print(json.dumps({"pontos": result["quantidade_total"], "rejeicoes": result["rejeicoes"], "fontes": len(result["fontes"])}, ensure_ascii=False))
