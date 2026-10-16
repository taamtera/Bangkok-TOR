"""Pure Python requirement coverage engine. JSON on stdin/stdout; no DB or AI calls.

Demo clauses are explicit so Docker cannot satisfy an entire microservices clause.
Evidence confidence is reported separately from wording/requirement coverage.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

POLICY_VERSION = 3
WEIGHTS = {"required": 3, "preferred": 1, "mentioned": 1, "informational": 0}
EVIDENCE = {"claimed": 0.5, "experienced": 0.75, "verified": 1.0}
GENERIC = {"app", "application", "data", "development", "government", "hospital",
           "network", "service", "software", "system", "web"}
CATALOG = json.loads(Path(__file__).with_name("concepts.json").read_text(encoding="utf-8"))
DEMO_CLAUSES = {
    "Experience developing large-scale data management or EHR systems": [
        {"anyOf": ["large-scale-data", "ehr"], "related": {"hospital-system": 0.5}}],
    "ISO 27001 information security certification": [{"anyOf": ["iso-27001"]}],
    "Microservices architecture with Docker or Kubernetes": [
        {"anyOf": ["microservices"]}, {"anyOf": ["docker", "kubernetes"]}],
}


def normalize(value):
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", str(value)).casefold()).strip()


def find_phrase(text, phrase):
    normalized = normalize(phrase)
    if len(normalized) < 3 or normalized in GENERIC:
        return None
    # Latin terms have token boundaries: ISO 270001 and MySQL do not match ISO
    # 27001 and SQL. Exact Thai phrase containment preserves script boundaries.
    escaped = re.escape(normalized).replace(r"\ ", r"\s+")
    pattern = rf"(?<!\w){escaped}(?!\w)" if re.search(r"[a-z0-9]", normalized) else escaped
    normalized_text = normalize(text)
    for found in re.finditer(pattern, normalized_text):
        prefix = normalized_text[max(0, found.start() - 60):found.start()]
        suffix = normalized_text[found.end():found.end() + 40]
        if re.search(r"\b(no|not|without|lack|lacking|never|cannot|don't|doesn't)\b[^.;,]{0,50}$", prefix):
            continue
        if re.match(r"\s+(?:is\s+)?(?:not\s+(?:certified|available|supported)|unavailable)\b", suffix):
            continue
        return found.group()
    return None


def vocabulary(active_tags):
    catalog = {key: {"name": value["name"], "aliases": list(value["aliases"])}
               for key, value in CATALOG.items()}
    tag_concepts = {}
    for tag in active_tags:
        name = str(tag.get("name") or "").strip()
        if not name:
            continue
        terms = [name] + [alias for alias in tag.get("aliases", []) if isinstance(alias, str)]
        canonical = tag.get("conceptKey") if tag.get("conceptKey") in catalog else next((key for key, item in catalog.items()
                          if normalize(name) in {normalize(alias) for alias in item["aliases"]}), None)
        canonical = canonical or "catalog:" + normalize(name)
        item = catalog.setdefault(canonical, {"name": name, "aliases": []})
        item["aliases"] = list(dict.fromkeys(item["aliases"] + terms))
        tag_concepts[str(tag["_id"])] = canonical
    return catalog, tag_concepts


def concept_mentions(text, catalog):
    return {key: next((matched for phrase in item["aliases"]
                       if (matched := find_phrase(text, phrase))), None)
            for key, item in catalog.items()}


def company_capabilities(company, catalog, tag_concepts):
    capabilities = {}

    def put(key, entry):
        current = capabilities.get(key)
        if not current or EVIDENCE[entry["verificationLevel"]] > EVIDENCE[current["verificationLevel"]]:
            capabilities[key] = entry

    for field in ("technologies", "qualifications"):
        for value in company.get(field, []):
            text = value if isinstance(value, str) else value.get("name", "")
            if not isinstance(text, str) or not text.strip():
                continue
            for key, phrase in concept_mentions(text, catalog).items():
                if phrase:
                    put(key, {"text": text, "source": "company_profile", "field": field,
                              "matchedPhrase": phrase, "verificationLevel": "claimed",
                              "evidence": f"Self-reported {field}: {text}"})

    # Preserve independently maintained evidence; profile text containing the
    # word 'experienced' or a verified flag never promotes itself to proof.
    for assignment in company.get("tagAssignments", []):
        level = assignment.get("verificationLevel")
        evidence = assignment.get("evidence") or ""
        key = tag_concepts.get(str(assignment.get("tagId")))
        if (not key or level not in EVIDENCE or assignment.get("reviewStatus") != "approved"
                or not isinstance(evidence, str) or not evidence.strip()
                or evidence.startswith("Self-reported company profile ")):
            continue
        put(key, {"text": catalog[key]["name"], "source": "company_tag_evidence",
                  "matchedPhrase": catalog[key]["name"], "verificationLevel": level,
                  "evidence": evidence})
    return capabilities


def clauses_for(requirement, catalog, tag_concepts):
    text = requirement["text"]
    # Compare the complete demo clause, not just its arbitrary database key.
    known = next((clauses for phrase, clauses in DEMO_CLAUSES.items()
                  if normalize(phrase) == normalize(text)), None)
    # Unparsed free-form requirements remain visible and unassessed. A future
    # extractor supplies explicit AND groups containing OR alternatives.
    supplied = requirement.get("clauses")
    if isinstance(supplied, list) and supplied and all(
            isinstance(clause, dict) and isinstance(clause.get("anyOf"), list)
            and clause["anyOf"] and all(key in catalog for key in clause["anyOf"])
            for clause in supplied):
        return [{"anyOf": clause["anyOf"]} for clause in supplied]
    if known and requirement.get("sourceType") == "demo":
        return known
    if requirement.get("tagId") in tag_concepts:
        return [{"anyOf": [tag_concepts[requirement["tagId"]]]}]
    return []


def compare_requirement(requirement, capabilities, catalog, tag_concepts):
    clauses = clauses_for(requirement, catalog, tag_concepts)
    components = []
    for clause in clauses:
        candidates = [(key, 1.0) for key in clause["anyOf"] if key in capabilities]
        candidates += [(key, factor) for key, factor in clause.get("related", {}).items()
                       if key in capabilities]
        best = max(candidates, key=lambda item: (item[1], EVIDENCE[capabilities[item[0]]["verificationLevel"]]), default=None)
        key, fraction = best if best else (None, 0.0)
        components.append({
            "requiredConcepts": clause["anyOf"],
            "label": " or ".join(catalog[item]["name"] for item in clause["anyOf"]),
            "status": "met" if fraction == 1 else "partial" if fraction else "missing",
            "coverage": fraction, "matchedConcept": key,
            "companyCapability": capabilities.get(key),
            "evidenceFactor": EVIDENCE[capabilities[key]["verificationLevel"]] if key else 0,
        })
    fraction = sum(item["coverage"] for item in components) / len(components) if components else 0
    evidence_fraction = (sum(item["coverage"] * item["evidenceFactor"] for item in components)
                         / len(components) if components else 0)
    importance = requirement.get("importance", "required")
    status = ("informational" if importance == "informational" else "unassessed" if not components
              else "met" if fraction == 1 else "partial" if fraction else "missing")
    found = [item["companyCapability"] for item in components if item["companyCapability"]]
    return {
        "requirementId": requirement["key"], "tagId": requirement.get("tagId"),
        "tagName": requirement["text"], "requirementText": requirement["text"],
        "requirementLevel": importance, "status": status,
        "coverage": round(fraction * 100), "evidenceScore": round(evidence_fraction * 100),
        "verificationLevel": min((item["verificationLevel"] for item in found), key=EVIDENCE.get) if found else None,
        "requirementEvidence": requirement.get("evidence"),
        "requirementSourceUrl": requirement.get("sourceUrl"),
        "requirementSourcePage": requirement.get("sourcePage"),
        "sourceType": requirement.get("sourceType"),
        "companyEvidence": "; ".join(dict.fromkeys(item["evidence"] for item in found)) or None,
        "components": components,
    }


def match_company(company, tor, catalog, tag_concepts):
    capabilities = company_capabilities(company, catalog, tag_concepts)
    requirements = [compare_requirement(item, capabilities, catalog, tag_concepts)
                    for item in tor.get("matchingRequirements", [])]
    weight = sum(WEIGHTS.get(item["requirementLevel"], 0) for item in requirements)
    score = (round(sum(WEIGHTS.get(item["requirementLevel"], 0) * item["coverage"]
                       for item in requirements) / weight) if weight else 0)
    evidence_score = (round(sum(WEIGHTS.get(item["requirementLevel"], 0) * item["evidenceScore"]
                                for item in requirements) / weight) if weight else 0)
    scored = [item for item in requirements if WEIGHTS.get(item["requirementLevel"], 0)]
    counts = {status: sum(item["status"] == status for item in scored)
              for status in ("met", "partial", "missing", "unassessed")}
    demo = any(item["sourceType"] == "demo" for item in requirements)
    strengths = [f'{item["tagName"]}: {item["status"]}' for item in scored if item["status"] in ("met", "partial")]
    gaps = [f'{item["tagName"]}: {component["label"]} {component["status"]}'
            for item in scored for component in item["components"] if component["status"] != "met"]
    gaps += [f'{item["tagName"]}: wording needs interpretation' for item in scored if item["status"] == "unassessed"]
    return {
        "companyId": str(company["_id"]), "torId": str(tor["_id"]),
        "torVersion": tor["matchingVersion"], "resultType": "requirement_match",
        "score": score, "evidenceScore": evidence_score,
        "dataMode": "demo" if demo else "source", "requirementMatches": requirements,
        "counts": counts, "strengths": strengths, "gaps": gaps,
        "status": "compared" if scored else "requirements_unavailable",
        "explanation": (f'{counts["met"]} matched, {counts["partial"]} partly matched, '
                        f'{counts["missing"]} missing, {counts["unassessed"]} unassessed. '
                        'The score measures requirement coverage; company profile entries are self-reported.'
                        if scored else 'This project has no stored requirements to compare yet.'),
        "policyVersion": POLICY_VERSION,
        "companyCapabilities": [{"concept": key, "name": catalog[key]["name"], **value}
                                for key, value in capabilities.items()],
    }


def run(payload):
    catalog, tag_concepts = vocabulary(payload.get("activeTags", []))
    return {"policyVersion": POLICY_VERSION, "engine": "python-rules",
            "items": [match_company(company, tor, catalog, tag_concepts)
                      for company in payload["companies"] for tor in payload["tors"]]}


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        json.dump(run(payload), sys.stdout, ensure_ascii=True, allow_nan=False)
    except (ValueError, KeyError, TypeError) as error:
        print(f"Matching input is invalid: {type(error).__name__}", file=sys.stderr)
        sys.exit(1)
