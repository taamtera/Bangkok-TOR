import unittest
from engine import DEMO_CLAUSES, run


def compare(technologies=(), qualifications=(), requirements=None, assignments=(), tags=()):
    if requirements is None:
        requirements = [{"key": str(index), "text": text, "importance": "required", "sourceType": "demo"}
                        for index, text in enumerate(DEMO_CLAUSES)]
    return run({"companies": [{"_id": "company", "technologies": list(technologies),
                                "qualifications": list(qualifications), "tagAssignments": list(assignments)}],
                "tors": [{"_id": "tor", "matchingVersion": 1, "matchingRequirements": requirements}],
                "activeTags": list(tags)})["items"][0]


def requirement(index, importance="required"):
    return {"key": str(index), "text": list(DEMO_CLAUSES)[index], "importance": importance, "sourceType": "demo"}


class PythonMatchingTests(unittest.TestCase):
    def test_current_demo_profile_has_one_direct_and_two_partial_matches(self):
        result = compare(["Docker", "Flutter", "PostgreSQL"],
                         ["Hospital information system development", "ISO/IEC 27001 certification"])
        self.assertEqual(result["score"], 67)
        self.assertEqual([item["status"] for item in result["requirementMatches"]], ["partial", "met", "partial"])
        self.assertEqual(result["evidenceScore"], 33)
        self.assertNotIn("recommendation", result)

    def test_direct_coverage_does_not_claim_independent_verification(self):
        result = compare(["Docker", "Microservices"], ["EHR development", "ISO 27001"])
        self.assertEqual(result["score"], 100)
        self.assertEqual(result["evidenceScore"], 50)
        self.assertTrue(all(item["verificationLevel"] == "claimed" for item in result["requirementMatches"]))

    def test_empty_profile_has_zero_coverage(self):
        result = compare()
        self.assertEqual(result["score"], 0)
        self.assertEqual(result["counts"]["missing"], 3)

    def test_iso_typo_does_not_satisfy_certification(self):
        result = compare(["ISO 270001"], ["ISO270001"], [requirement(1)])
        self.assertEqual(result["score"], 0)

    def test_iso_aliases_and_unicode_normalization(self):
        for value in ["ISO/IEC27001 certification", "iso-27001", "ISO  27001", "ＩＳＯ ２７００１"]:
            with self.subTest(value=value):
                self.assertEqual(compare(qualifications=[value], requirements=[requirement(1)])["score"], 100)

    def test_docker_alone_only_satisfies_half_the_compound_clause(self):
        result = compare(["Docker"], requirements=[requirement(2)])
        self.assertEqual(result["score"], 50)
        self.assertEqual([part["status"] for part in result["requirementMatches"][0]["components"]], ["missing", "met"])

    def test_kubernetes_is_an_alternative_to_docker(self):
        result = compare(["Microservices", "K8s"], requirements=[requirement(2)])
        self.assertEqual(result["score"], 100)

    def test_two_tool_alternatives_do_not_replace_microservices(self):
        self.assertEqual(compare(["Docker", "Kubernetes"], requirements=[requirement(2)])["score"], 50)

    def test_hospital_system_is_related_but_not_full_ehr_experience(self):
        self.assertEqual(compare(qualifications=["develop a hospital system"], requirements=[requirement(0)])["score"], 50)

    def test_generic_words_do_not_create_matches(self):
        self.assertEqual(compare(["software", "system", "development", "hospital"])["score"], 0)

    def test_duplicate_synonyms_do_not_inflate_coverage(self):
        base = compare(qualifications=["ISO 27001"], requirements=[requirement(1)])
        duplicate = compare(qualifications=["ISO 27001", "ISO/IEC 27001 certification"], requirements=[requirement(1)])
        self.assertEqual(base["score"], duplicate["score"])
        self.assertEqual(len(duplicate["companyCapabilities"]), 1)

    def test_profile_experienced_or_verified_words_remain_self_reported(self):
        result = compare(qualifications=[{"name": "Experienced EHR development", "verified": True}], requirements=[requirement(0)])
        self.assertEqual(result["evidenceScore"], 50)
        self.assertEqual(result["requirementMatches"][0]["verificationLevel"], "claimed")

    def test_negative_claim_is_not_a_capability(self):
        result = compare(["No experience with Docker", "Not ISO 27001 certified"])
        self.assertEqual(result["score"], 0)

    def test_unknown_requirement_is_unassessed_not_guessed(self):
        result = compare(["Docker"], requirements=[{"key": "MICROSERVICES", "text": "Supply 40 chairs",
                                                   "importance": "required", "sourceType": "demo"}])
        self.assertEqual(result["requirementMatches"][0]["status"], "unassessed")
        self.assertEqual(result["score"], 0)

    def test_preferred_requirement_has_lower_weight(self):
        result = compare(qualifications=["ISO 27001"], requirements=[requirement(1), requirement(2, "preferred")])
        self.assertEqual(result["score"], 75)

    def test_informational_requirement_does_not_change_coverage(self):
        result = compare(qualifications=["ISO 27001"], requirements=[requirement(1), requirement(2, "informational")])
        self.assertEqual(result["score"], 100)
        self.assertEqual(result["requirementMatches"][1]["status"], "informational")

    def test_no_requirements_is_unavailable_instead_of_ai_recommendation(self):
        result = compare(["Docker"], requirements=[])
        self.assertEqual(result["status"], "requirements_unavailable")
        self.assertEqual(result["score"], 0)

    def test_profile_change_recomputes_zero_instead_of_reusing_previous_score(self):
        first = compare(["Docker"], requirements=[requirement(2)])
        second = compare([], requirements=[requirement(2)])
        self.assertEqual(first["score"], 50)
        self.assertEqual(second["score"], 0)

    def test_explicit_ai_clauses_take_priority_over_demo_wording(self):
        item = requirement(2)
        item["sourceType"] = "ai_extracted_requirement"
        item["clauses"] = [{"anyOf": ["docker"]}]
        self.assertEqual(compare(["Docker"], requirements=[item])["score"], 100)

    def test_unavailable_tag_keeps_requirement_unassessed_and_in_denominator(self):
        item = {"key": "inactive", "text": "Inactive catalog requirement", "importance": "required",
                "sourceType": "ai_extracted_requirement", "clauses": [{"anyOf": ["unavailable:tag"]}]}
        result = compare(qualifications=["ISO 27001"], requirements=[requirement(1), item])
        self.assertEqual(result["score"], 50)
        self.assertEqual(result["requirementMatches"][1]["status"], "unassessed")

    def test_independent_approved_tag_evidence_is_preserved(self):
        result = compare(requirements=[requirement(1)], tags=[{"_id": "iso", "name": "ISO 27001"}],
                         assignments=[{"tagId": "iso", "reviewStatus": "approved", "verificationLevel": "verified",
                                       "evidence": "Certificate checked against issuing body"}])
        self.assertEqual(result["score"], 100)
        self.assertEqual(result["evidenceScore"], 100)


if __name__ == "__main__":
    unittest.main()
