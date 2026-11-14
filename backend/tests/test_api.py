import json
import os
import tempfile
import time
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

os.environ["SKILLCERT_SECRET_KEY"] = "test-only-signing-key"
os.environ["SKILLCERT_DATABASE"] = str(Path(tempfile.gettempdir()) / "skillcert-import-test.sqlite3")

from werkzeug.security import generate_password_hash

from app import create_app


class SkillCertApiTests(unittest.TestCase):
    def setUp(self):
        from app import RATE_LIMITS
        RATE_LIMITS.clear()
        self.temp = tempfile.TemporaryDirectory()
        self.app = create_app({
            "TESTING": True,
            "DATABASE": str(Path(self.temp.name) / "test.sqlite3"),
            "TOKEN_SECRET": "test-signing-key",
            "FRONTEND_ORIGIN": "http://localhost:5173",
            "PUBLIC_APP_URL": "http://localhost:5000",
            "AI_PROVIDER": "offline",
            "AI_API_KEY": "",
        })
        self.client = self.app.test_client()
        with self.app.app_context():
            from app import get_db
            db = get_db()
            for name, role, email in (
                ("Instructor", "instructor", "instructor@example.test"),
                ("Other Instructor", "instructor", "other@example.test"),
                ("Administrator", "admin", "admin@example.test"),
            ):
                db.execute(
                    "INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)",
                    (name, email, generate_password_hash("Long-password-123"), role),
                )
            db.commit()
        self.student_token = self.register("student@example.test")
        self.instructor_token = self.login("instructor@example.test")
        self.admin_token = self.login("admin@example.test")

    def tearDown(self):
        self.temp.cleanup()

    @staticmethod
    def auth(token):
        return {"Authorization": f"Bearer {token}"}

    def register(self, email):
        response = self.client.post("/api/auth/register", json={
            "name": "Test Student", "email": email, "password": "Secure-passphrase-123",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["token"]

    def login(self, email):
        response = self.client.post("/api/auth/login", json={
            "email": email, "password": "Long-password-123",
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["token"]

    def create_assessment(self, token=None, status="published", category="Python"):
        question = {
            "prompt": "What is the Python function keyword?",
            "type": "mcq",
            "options": [{"id": "a", "text": "func"}, {"id": "b", "text": "def"}],
            "correct_answers": ["b"],
            "marks": 10,
            "difficulty": "Beginner",
        }
        response = self.client.post("/api/management/assessments", headers=self.auth(token or self.instructor_token),
                                   json={
            "title": "Python Basics", "description": "Test", "instructions": "Choose one.",
            "category": category, "difficulty": "Beginner", "duration_minutes": 30,
            "pass_percent": 70, "negative_marking": 0, "attempt_limit": 2,
            "status": status, "questions": [question],
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["id"]

    def start_attempt(self, assessment_id):
        response = self.client.post(
            f"/api/assessments/{assessment_id}/attempts", headers=self.auth(self.student_token)
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def test_registration_hashes_password_and_login_rejects_wrong_password(self):
        response = self.client.post("/api/auth/login", json={
            "email": "student@example.test", "password": "wrong-password",
        })
        self.assertEqual(response.status_code, 401)
        with self.app.app_context():
            from app import get_db
            row = get_db().execute("SELECT password_hash FROM users WHERE email=?",
                                   ("student@example.test",)).fetchone()
            self.assertNotEqual(row["password_hash"], "Secure-passphrase-123")
            self.assertTrue(row["password_hash"].startswith("scrypt:"))

    def test_registration_allows_local_vite_origin_when_custom_origin_is_configured(self):
        response = self.client.post(
            "/api/auth/register",
            headers={"Origin": "http://localhost:5174"},
            json={
                "name": "Vite Origin Test",
                "email": "vite-origin@example.test",
                "password": "Secure-passphrase-123",
            },
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        self.assertEqual(
            response.headers.get("Access-Control-Allow-Origin"),
            "http://localhost:5174",
        )

    def test_client_cannot_choose_role_and_logout_revokes_token(self):
        registration = self.client.post("/api/auth/register", json={
            "name": "Escalation Attempt",
            "email": "role-attempt@example.test",
            "password": "Secure-passphrase-123",
            "role": "admin",
        })
        self.assertEqual(registration.status_code, 201)
        self.assertEqual(registration.get_json()["role"], "student")
        token = registration.get_json()["token"]
        self.assertEqual(self.client.get("/api/admin/metrics", headers=self.auth(token)).status_code, 403)
        self.assertEqual(self.client.post("/api/auth/logout", headers=self.auth(token)).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers=self.auth(token)).status_code, 401)

    def test_question_generation_is_a_reviewable_draft(self):
        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="test-api-key")
        generated = [{
            "prompt": "Which Rust keyword declares an immutable binding?",
            "type": "mcq",
            "options": [
                {"id": "a", "text": "let"},
                {"id": "b", "text": "var"},
                {"id": "c", "text": "const"},
                {"id": "d", "text": "def"},
            ],
            "correct_answers": ["a"],
            "marks": 1,
            "difficulty": "Beginner",
            "category": "Rust",
            "explanation": "Rust uses let bindings, which are immutable by default.",
        }]
        with patch("app.call_ai_provider", return_value=generated):
            response = self.client.post(
                "/api/management/questions/generate",
                headers=self.auth(self.instructor_token),
                json={"topic": "Rust", "difficulty": "Beginner", "type": "mcq", "count": 1},
            )
        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertTrue(payload["draft_only"])
        self.assertTrue(payload["human_review_required"])
        self.assertEqual(payload["source"], "groq")
        self.assertEqual(len(payload["questions"]), 1)
        self.assertEqual(payload["questions"][0]["category"], "Rust")

    def test_question_generation_requires_groq_key_when_groq_is_selected(self):
        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="")
        response = self.client.post(
            "/api/management/questions/generate",
            headers=self.auth(self.instructor_token),
            json={"topic": "Go", "difficulty": "Beginner", "type": "mcq", "count": 1},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("AI_API_KEY", response.get_json()["error"]["message"])

    def test_gemini_question_generation_requires_a_gemini_key(self):
        self.app.config.update(AI_PROVIDER="gemini", GEMINI_API_KEY="")
        response = self.client.post(
            "/api/management/questions/generate",
            headers=self.auth(self.instructor_token),
            json={"topic": "Go", "difficulty": "Beginner", "type": "mcq", "count": 1},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.get_json()["error"]["message"])

    def test_question_generation_rejects_malformed_provider_output(self):
        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="test-api-key")
        with patch("app.call_ai_provider", return_value=[]):
            response = self.client.post(
                "/api/management/questions/generate",
                headers=self.auth(self.instructor_token),
                json={"topic": "Rust", "difficulty": "Beginner", "type": "mcq", "count": 1},
            )
        self.assertEqual(response.status_code, 502)
        self.assertIn("generation failed", response.get_json()["error"]["message"].lower())

    def test_question_generation_supports_100_questions_in_provider_batches(self):
        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="test-api-key")
        generated_count = 0

        def generate_batch(topic, difficulty, question_type, count, api_key, previous_prompts):
            nonlocal generated_count
            batch = []
            for _ in range(count):
                generated_count += 1
                batch.append({
                    "prompt": f"Rust question {generated_count}?",
                    "type": question_type,
                    "options": [
                        {"id": "a", "text": "Answer A"},
                        {"id": "b", "text": "Answer B"},
                        {"id": "c", "text": "Answer C"},
                        {"id": "d", "text": "Answer D"},
                    ],
                    "correct_answers": ["a"],
                    "marks": 1,
                    "difficulty": difficulty,
                    "category": topic,
                    "explanation": "Review this answer.",
                })
            return batch

        with patch("app.call_ai_provider", side_effect=generate_batch) as provider:
            response = self.client.post(
                "/api/management/questions/generate",
                headers=self.auth(self.instructor_token),
                json={"topic": "Rust", "difficulty": "Beginner", "type": "mcq", "count": 100},
            )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(response.get_json()["questions"]), 100)
        batch_sizes = [call.args[3] for call in provider.call_args_list]
        self.assertEqual(batch_sizes, [8] * 12 + [4])
        self.assertEqual(sum(batch_sizes), 100)

    def test_provider_prompt_sets_difficulty_specific_expectations(self):
        from app import call_ai_provider

        payload = {
            "questions": [{
                "prompt": "Example technical question?",
                "type": "mcq",
                "options": [
                    {"id": "a", "text": "A"},
                    {"id": "b", "text": "B"},
                    {"id": "c", "text": "C"},
                    {"id": "d", "text": "D"},
                ],
                "correct_answers": ["a"],
                "marks": 1,
                "difficulty": "Beginner",
                "category": "Rust",
                "explanation": "Example explanation.",
            }]
        }
        response_body = json.dumps({
            "choices": [{"message": {"content": json.dumps(payload)}}]
        }).encode()

        with self.app.app_context(), patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value.__enter__.return_value.read.return_value = response_body
            for difficulty, expected in (
                ("Beginner", "foundational concept"),
                ("Intermediate", "multiple familiar concepts"),
                ("Advanced", "multi-step reasoning"),
            ):
                with self.subTest(difficulty=difficulty):
                    call_ai_provider("Rust", difficulty, "mcq", 1, "test-api-key")
                    request_obj = urlopen.call_args.args[0]
                    request_payload = json.loads(request_obj.data)
                    self.assertIn(expected, request_payload["messages"][1]["content"])
                    self.assertEqual(request_obj.get_header("User-agent"), "SkillCertPro/1.0")

    def test_provider_http_errors_are_reported_without_exposing_provider_response(self):
        from urllib.error import HTTPError

        from app import call_ai_provider

        for status, expected in (
            (401, r"Groq rejected AI_API_KEY \(HTTP 401\)"),
            (429, "rate-limiting quiz generation"),
            (404, "configured Groq model was not found"),
            (503, "temporarily unavailable"),
        ):
            with self.subTest(status=status), self.app.app_context():
                with patch(
                    "urllib.request.urlopen",
                    side_effect=HTTPError(
                        "https://api.groq.com/",
                        status,
                        "upstream failure",
                        {},
                        BytesIO(),
                    ),
                ):
                    with self.assertRaisesRegex(RuntimeError, expected):
                        call_ai_provider("Rust", "Beginner", "mcq", 1, "test-api-key")

    def test_gemini_provider_uses_generate_content_json_mode(self):
        from app import call_gemini_provider

        payload = {
            "questions": [{
                "prompt": "Which Go keyword declares a function?",
                "type": "mcq",
                "options": [
                    {"id": "a", "text": "func"},
                    {"id": "b", "text": "def"},
                    {"id": "c", "text": "function"},
                    {"id": "d", "text": "lambda"},
                ],
                "correct_answers": ["a"],
                "marks": 1,
                "explanation": "Go uses func to declare functions.",
            }]
        }
        response_body = json.dumps({
            "candidates": [{
                "content": {"parts": [{"text": json.dumps(payload)}]}
            }]
        }).encode()

        with self.app.app_context(), patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value.__enter__.return_value.read.return_value = response_body
            result = call_gemini_provider(
                "Go", "Beginner", "mcq", 1, "test-gemini-key"
            )

        request_obj = urlopen.call_args.args[0]
        self.assertEqual(
            request_obj.full_url,
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.app.config['GEMINI_MODEL']}:generateContent",
        )
        self.assertEqual(request_obj.get_header("X-goog-api-key"), "test-gemini-key")
        request_payload = json.loads(request_obj.data)
        self.assertEqual(request_payload["generationConfig"]["responseMimeType"], "application/json")
        self.assertEqual(request_payload["generationConfig"]["maxOutputTokens"], 8192)
        self.assertEqual(len(result), 1)

    def test_gemini_provider_ignores_thought_parts_before_json(self):
        from app import call_gemini_provider

        payload = {
            "questions": [{
                "prompt": "Which Go keyword declares a function?",
                "type": "mcq",
                "options": [
                    {"id": "a", "text": "func"},
                    {"id": "b", "text": "def"},
                    {"id": "c", "text": "function"},
                    {"id": "d", "text": "lambda"},
                ],
                "correct_answers": ["a"],
                "marks": 1,
                "explanation": "Go uses func to declare functions.",
            }]
        }
        response_body = json.dumps({
            "candidates": [{
                "finishReason": "STOP",
                "content": {"parts": [
                    {"text": "Internal reasoning that is not JSON.", "thought": True},
                    {"text": json.dumps(payload)},
                ]},
            }]
        }).encode()

        with self.app.app_context(), patch("urllib.request.urlopen") as urlopen:
            urlopen.return_value.__enter__.return_value.read.return_value = response_body
            result = call_gemini_provider("Go", "Beginner", "mcq", 1, "test-gemini-key")

        self.assertEqual(len(result), 1)

    def test_provider_retries_rate_limits_and_distinguishes_exhausted_quota(self):
        from urllib.error import HTTPError
        from urllib.request import urlopen

        from app import call_ai_provider

        payload = {
            "questions": [{
                "prompt": "Example technical question?",
                "type": "mcq",
                "options": [
                    {"id": "a", "text": "A"},
                    {"id": "b", "text": "B"},
                    {"id": "c", "text": "C"},
                    {"id": "d", "text": "D"},
                ],
                "correct_answers": ["a"],
                "marks": 1,
                "explanation": "Example explanation.",
            }]
        }
        response_body = json.dumps({
            "choices": [{"message": {"content": json.dumps(payload)}}]
        }).encode()
        rate_limited = HTTPError(
            "https://api.groq.com/",
            429,
            "rate limited",
            {"Retry-After": "0"},
            BytesIO(json.dumps({"error": {"code": "rate_limit_exceeded"}}).encode()),
        )
        successful_response = unittest.mock.MagicMock()
        successful_response.__enter__.return_value.read.return_value = response_body

        with self.app.app_context(), patch(
            "urllib.request.urlopen", side_effect=[rate_limited, successful_response]
        ) as provider:
            result = call_ai_provider("Rust", "Beginner", "mcq", 1, "test-api-key")
        self.assertEqual(len(result), 1)
        self.assertEqual(provider.call_count, 2)

        exhausted_quota = HTTPError(
            "https://api.groq.com/",
            429,
            "quota exhausted",
            {},
            BytesIO(json.dumps({
                "error": {"code": "insufficient_quota", "message": "Quota exceeded."}
            }).encode()),
        )
        with self.app.app_context(), patch(
            "urllib.request.urlopen", side_effect=exhausted_quota
        ) as provider:
            with self.assertRaisesRegex(RuntimeError, "usage quota is exhausted"):
                call_ai_provider("Rust", "Beginner", "mcq", 1, "test-api-key")
        self.assertEqual(provider.call_count, 1)

    def test_question_generation_rejects_count_over_100(self):
        response = self.client.post(
            "/api/management/questions/generate",
            headers=self.auth(self.instructor_token),
            json={"topic": "Rust", "difficulty": "Beginner", "type": "mcq", "count": 101},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("1 and 100", response.get_json()["error"]["message"])

    def test_practice_question_generation_requires_authentication(self):
        response = self.client.post(
            "/api/practice/questions/generate",
            json={"topic": "Rust", "difficulty": "Beginner", "count": 1},
        )
        self.assertEqual(response.status_code, 401)

    def test_failed_practice_generation_does_not_consume_per_user_limit(self):
        payload = {"topic": "Rust", "difficulty": "Beginner", "count": 1}
        for _ in range(10):
            failed_response = self.client.post(
                "/api/practice/questions/generate",
                headers=self.auth(self.student_token),
                json=payload,
            )
            self.assertEqual(failed_response.status_code, 503)

        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="test-api-key")
        generated = [{
            "prompt": "Which Rust feature enforces memory safety without a garbage collector?",
            "type": "mcq",
            "options": [
                {"id": "a", "text": "Ownership"},
                {"id": "b", "text": "Reflection"},
                {"id": "c", "text": "Inheritance"},
                {"id": "d", "text": "Macros"},
            ],
            "correct_answers": ["a"],
            "marks": 1,
            "difficulty": "Beginner",
            "category": "Rust",
            "explanation": "Ownership and borrowing provide compile-time memory safety.",
        }]
        with patch("app.generate_questions_in_batches", return_value=generated):
            for _ in range(20):
                successful_response = self.client.post(
                    "/api/practice/questions/generate",
                    headers=self.auth(self.student_token),
                    json=payload,
                )
                self.assertEqual(successful_response.status_code, 200)

            limited_response = self.client.post(
                "/api/practice/questions/generate",
                headers=self.auth(self.student_token),
                json=payload,
            )
            self.assertEqual(limited_response.status_code, 429)
            self.assertIn(
                "20 successful quizzes per hour",
                limited_response.get_json()["error"]["message"],
            )
            self.assertGreater(int(limited_response.headers["Retry-After"]), 0)

            another_student = self.register("another-student@example.test")
            independent_response = self.client.post(
            "/api/practice/questions/generate",
            headers=self.auth(another_student),
            json=payload,
            )
            self.assertEqual(independent_response.status_code, 200)

    def test_student_can_generate_practice_questions_at_selected_difficulty(self):
        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="test-api-key")
        generated = [{
            "prompt": "Which Rust feature enforces memory safety without a garbage collector?",
            "type": "mcq",
            "options": [
                {"id": "a", "text": "Ownership"},
                {"id": "b", "text": "Reflection"},
                {"id": "c", "text": "Inheritance"},
                {"id": "d", "text": "Macros"},
            ],
            "correct_answers": ["a"],
            "marks": 1,
            "difficulty": "Advanced",
            "category": "Rust",
            "explanation": "Ownership and borrowing provide compile-time memory safety.",
        }]
        with patch("app.call_ai_provider", return_value=generated) as provider:
            response = self.client.post(
                "/api/practice/questions/generate",
                headers=self.auth(self.student_token),
                json={"topic": "Rust", "difficulty": "Advanced", "count": 1},
            )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(provider.call_args.args[1], "Advanced")
        payload = response.get_json()
        self.assertEqual(payload["source"], "groq")
        self.assertTrue(payload["practice_only"])
        self.assertEqual(len(payload["questions"]), 1)
        self.assertTrue(payload["questions"][0]["options"][0]["isCorrect"])
        self.assertIn("Ownership", payload["questions"][0]["explanation"])

    def test_student_can_generate_practice_questions_with_gemini(self):
        self.app.config.update(AI_PROVIDER="gemini", GEMINI_API_KEY="test-gemini-key")
        generated = [{
            "prompt": "Which Go keyword declares a function?",
            "type": "mcq",
            "options": [
                {"id": "a", "text": "func"},
                {"id": "b", "text": "def"},
                {"id": "c", "text": "function"},
                {"id": "d", "text": "lambda"},
            ],
            "correct_answers": ["a"],
            "marks": 1,
            "difficulty": "Beginner",
            "category": "Go",
            "explanation": "Go uses func to declare functions.",
        }]
        with patch("app.call_gemini_provider", return_value=generated) as provider:
            response = self.client.post(
                "/api/practice/questions/generate",
                headers=self.auth(self.student_token),
                json={"topic": "Go", "difficulty": "Beginner", "count": 1},
            )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["source"], "gemini")
        self.assertEqual(provider.call_args.args[4], "test-gemini-key")

    def test_practice_question_generation_supports_100_questions(self):
        self.app.config.update(AI_PROVIDER="groq", AI_API_KEY="test-api-key")
        generated_count = 0

        def generate_batch(topic, difficulty, question_type, count, api_key, previous_prompts):
            nonlocal generated_count
            batch = []
            for _ in range(count):
                generated_count += 1
                batch.append({
                    "prompt": f"Rust practice question {generated_count}?",
                    "type": question_type,
                    "options": [
                        {"id": "a", "text": "Answer A"},
                        {"id": "b", "text": "Answer B"},
                        {"id": "c", "text": "Answer C"},
                        {"id": "d", "text": "Answer D"},
                    ],
                    "correct_answers": ["a"],
                    "marks": 1,
                    "difficulty": difficulty,
                    "category": topic,
                    "explanation": "Review this answer.",
                })
            return batch

        with patch("app.call_ai_provider", side_effect=generate_batch) as provider:
            response = self.client.post(
                "/api/practice/questions/generate",
                headers=self.auth(self.student_token),
                json={"topic": "Rust", "difficulty": "Intermediate", "count": 100},
            )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(response.get_json()["questions"]), 100)
        batch_sizes = [call.args[3] for call in provider.call_args_list]
        self.assertEqual(batch_sizes, [8] * 12 + [4])
        self.assertTrue(all(call.args[1] == "Intermediate" for call in provider.call_args_list))

    def test_practice_question_generation_rejects_count_over_100(self):
        response = self.client.post(
            "/api/practice/questions/generate",
            headers=self.auth(self.student_token),
            json={"topic": "Rust", "difficulty": "Beginner", "count": 101},
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("1 and 100", response.get_json()["error"]["message"])

    def test_legacy_question_generator_requires_instructor_authentication(self):
        response = self.client.post(
            "/api/questions/generate",
            json={"subject": "Rust", "level": "Beginner", "count": 1},
        )
        self.assertEqual(response.status_code, 401)

    def test_assessment_can_use_a_custom_technical_topic(self):
        assessment_id = self.create_assessment(category="Kubernetes")
        with self.app.app_context():
            from app import get_db
            category = get_db().execute(
                "SELECT name FROM categories WHERE name=?", ("Kubernetes",)
            ).fetchone()
        self.assertIsNotNone(category)
        self.assertGreater(assessment_id, 0)

    def test_seeded_technical_categories_are_available_from_api(self):
        response = self.client.get("/api/categories")
        self.assertEqual(response.status_code, 200)
        categories = response.get_json()["items"]
        for category in ("Python", "TypeScript", "C#", "Go", "Rust", "Kotlin",
                         "Swift", "Dart", "SQL", "DevOps", "Cloud Computing"):
            self.assertIn(category, categories)

    def test_password_change_invalidates_old_session(self):
        changed = self.client.post(
            "/api/auth/change-password",
            headers=self.auth(self.student_token),
            json={"current_password": "Secure-passphrase-123", "new_password": "New-secure-passphrase-456"},
        )
        self.assertEqual(changed.status_code, 200)
        renewed_token = changed.get_json()["token"]
        self.assertEqual(self.client.get("/api/auth/me", headers=self.auth(renewed_token)).status_code, 200)
        self.assertEqual(self.client.get("/api/auth/me", headers=self.auth(self.student_token)).status_code, 401)
        login = self.client.post("/api/auth/login", json={
            "email": "student@example.test", "password": "New-secure-passphrase-456",
        })
        self.assertEqual(login.status_code, 200)

    def test_profile_update_returns_updated_account(self):
        response = self.client.put(
            "/api/profile",
            headers=self.auth(self.student_token),
            json={"name": "Updated Student", "email": "updated@example.test"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["name"], "Updated Student")
        self.assertEqual(response.get_json()["email"], "updated@example.test")
        current_user = self.client.get(
            "/api/auth/me",
            headers=self.auth(self.student_token),
        )
        self.assertEqual(current_user.status_code, 200)
        self.assertEqual(current_user.get_json()["name"], "Updated Student")

    def test_profile_photo_is_validated_and_returned(self):
        photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/pLsAAAAASUVORK5CYII="
        response = self.client.put(
            "/api/profile",
            headers=self.auth(self.student_token),
            json={
                "name": "Test Student",
                "email": "student@example.test",
                "profile_photo": photo,
            },
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json()["profile_photo"], photo)

        invalid = self.client.put(
            "/api/profile",
            headers=self.auth(self.student_token),
            json={
                "name": "Test Student",
                "email": "student@example.test",
                "profile_photo": "data:image/png;base64,YWJj",
            },
        )
        self.assertEqual(invalid.status_code, 400)

    def test_settings_preferences_round_trip_and_validate_types(self):
        notifications = self.client.get(
            "/api/settings/notifications",
            headers=self.auth(self.student_token),
        )
        self.assertEqual(notifications.status_code, 200)
        self.assertEqual(notifications.get_json(), {
            "email_notifications_enabled": False,
            "in_app_notifications_enabled": True,
        })

        saved_notifications = self.client.put(
            "/api/settings/notifications",
            headers=self.auth(self.student_token),
            json={
                "email_notifications_enabled": True,
                "in_app_notifications_enabled": False,
            },
        )
        self.assertEqual(saved_notifications.status_code, 200)
        self.assertFalse(saved_notifications.get_json()["email_delivery_configured"])
        self.assertEqual(
            self.client.get(
                "/api/settings/notifications",
                headers=self.auth(self.student_token),
            ).get_json(),
            {
                "email_notifications_enabled": True,
                "in_app_notifications_enabled": False,
            },
        )
        invalid_notifications = self.client.put(
            "/api/settings/notifications",
            headers=self.auth(self.student_token),
            json={"email_notifications_enabled": 1, "in_app_notifications_enabled": False},
        )
        self.assertEqual(invalid_notifications.status_code, 400)

        privacy = self.client.put(
            "/api/settings/privacy",
            headers=self.auth(self.student_token),
            json={"share_usage_data": True},
        )
        self.assertEqual(privacy.status_code, 200)
        self.assertTrue(
            self.client.get(
                "/api/settings/privacy",
                headers=self.auth(self.student_token),
            ).get_json()["share_usage_data"]
        )
        invalid_privacy = self.client.put(
            "/api/settings/privacy",
            headers=self.auth(self.student_token),
            json={"share_usage_data": "true"},
        )
        self.assertEqual(invalid_privacy.status_code, 400)

    def test_disabling_in_app_notifications_prevents_result_notification(self):
        self.client.put(
            "/api/settings/notifications",
            headers=self.auth(self.student_token),
            json={
                "email_notifications_enabled": False,
                "in_app_notifications_enabled": False,
            },
        )
        attempt = self.start_attempt(self.create_assessment())
        self.client.put(
            f"/api/attempts/{attempt['id']}/responses",
            headers=self.auth(self.student_token),
            json={"question_id": attempt["questions"][0]["id"], "answer": "b"},
        )
        result = self.client.post(
            f"/api/attempts/{attempt['id']}/submit",
            headers=self.auth(self.student_token),
        )
        self.assertEqual(result.status_code, 200)
        self.assertEqual(
            self.client.get(
                "/api/notifications",
                headers=self.auth(self.student_token),
            ).get_json()["items"],
            [],
        )

    def test_export_contains_account_data_without_credentials(self):
        response = self.client.get(
            "/api/account/export",
            headers=self.auth(self.student_token),
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment;", response.headers["Content-Disposition"])
        payload = response.get_json()
        self.assertEqual(payload["profile"]["email"], "student@example.test")
        self.assertIn("preferences", payload)
        self.assertIn("attempts", payload)
        self.assertNotIn("password_hash", payload["profile"])

    def test_logout_other_sessions_preserves_replacement_token_only(self):
        response = self.client.post(
            "/api/auth/logout-other-sessions",
            headers=self.auth(self.student_token),
            json={},
        )
        self.assertEqual(response.status_code, 200)
        replacement_token = response.get_json()["token"]
        self.assertEqual(
            self.client.get("/api/auth/me", headers=self.auth(replacement_token)).status_code,
            200,
        )
        self.assertEqual(
            self.client.get("/api/auth/me", headers=self.auth(self.student_token)).status_code,
            401,
        )

    def test_account_deletion_anonymizes_profile_and_invalidates_session(self):
        attempt = self.start_attempt(self.create_assessment())
        self.client.put(
            "/api/settings/privacy",
            headers=self.auth(self.student_token),
            json={"share_usage_data": True},
        )
        wrong_password = self.client.delete(
            "/api/account",
            headers=self.auth(self.student_token),
            json={
                "current_password": "wrong-password",
                "confirmation": "DELETE",
            },
        )
        self.assertEqual(wrong_password.status_code, 400)

        deleted = self.client.delete(
            "/api/account",
            headers=self.auth(self.student_token),
            json={
                "current_password": "Secure-passphrase-123",
                "confirmation": "DELETE",
            },
        )
        self.assertEqual(deleted.status_code, 200, deleted.get_json())
        self.assertEqual(
            self.client.get("/api/auth/me", headers=self.auth(self.student_token)).status_code,
            401,
        )
        with self.app.app_context():
            from app import get_db
            row = get_db().execute(
                "SELECT name,email,profile_photo_data FROM users WHERE email LIKE 'deleted-%@deleted.invalid'"
            ).fetchone()
            self.assertIsNotNone(row)
            self.assertEqual(row["name"], "Deleted account")
            self.assertIsNone(row["profile_photo_data"])
            self.assertIsNone(
                get_db().execute(
                    "SELECT 1 FROM user_preferences WHERE user_id=(SELECT id FROM users WHERE email LIKE 'deleted-%@deleted.invalid')"
                ).fetchone()
            )
            self.assertIsNotNone(
                get_db().execute(
                    "SELECT 1 FROM attempts WHERE id=?",
                    (attempt["id"],),
                ).fetchone()
            )

    def test_csv_export_escapes_formula_cells(self):
        from app import safe_csv_cell

        self.assertEqual(safe_csv_cell("=HYPERLINK(\"x\")"), "'=HYPERLINK(\"x\")")
        self.assertEqual(safe_csv_cell("  +1+2"), "'  +1+2")
        self.assertEqual(safe_csv_cell("ordinary text"), "ordinary text")

    def test_permissions_and_instructor_ownership(self):
        response = self.client.post("/api/management/assessments", headers=self.auth(self.student_token),
                                    json={})
        self.assertEqual(response.status_code, 403)
        assessment_id = self.create_assessment()
        second_instructor = self.login("other@example.test")
        managed = self.client.get("/api/management/assessments", headers=self.auth(second_instructor))
        self.assertEqual(len(managed.get_json()["items"]), 0)
        self.assertEqual(self.client.get("/api/admin/metrics", headers=self.auth(self.student_token)).status_code, 403)
        self.assertEqual(self.client.get(f"/api/assessments/{assessment_id}").status_code, 200)

    def test_question_answers_are_not_exposed_before_submit(self):
        attempt = self.start_attempt(self.create_assessment())
        self.assertNotIn("correct_answers", str(attempt))
        response = self.client.get(f"/api/attempts/{attempt['id']}", headers=self.auth(self.student_token))
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("correct_answers", str(response.get_json()))

    def test_server_scoring_result_certificate_and_public_verification(self):
        assessment_id = self.create_assessment()
        attempt = self.start_attempt(assessment_id)
        question_id = attempt["questions"][0]["id"]
        saved = self.client.put(f"/api/attempts/{attempt['id']}/responses",
                                headers=self.auth(self.student_token),
                                json={"question_id": question_id, "answer": "b"})
        self.assertEqual(saved.status_code, 200)
        result = self.client.post(f"/api/attempts/{attempt['id']}/submit",
                                  headers=self.auth(self.student_token)).get_json()
        self.assertTrue(result["passed"])
        self.assertEqual(result["score_percent"], 100)
        history = self.client.get("/api/results", headers=self.auth(self.student_token)).get_json()
        certificate_id = history["items"][0]["certificate_id"]
        verified = self.client.get(f"/api/certificates/verify/{certificate_id}")
        self.assertEqual(verified.status_code, 200)
        self.assertEqual(verified.get_json()["status"], "valid")
        pdf = self.client.get(f"/api/certificates/{certificate_id}/pdf")
        self.assertEqual(pdf.status_code, 200)
        self.assertTrue(pdf.data.startswith(b"%PDF-1.4"))
        duplicate = self.client.post(f"/api/attempts/{attempt['id']}/submit",
                                     headers=self.auth(self.student_token)).get_json()
        self.assertEqual(duplicate["score_percent"], 100)
        with self.app.app_context():
            from app import get_db
            self.assertEqual(get_db().execute("SELECT COUNT(*) n FROM certificates").fetchone()["n"], 1)

    def test_time_expiry_autosubmits_and_prevents_late_response(self):
        attempt = self.start_attempt(self.create_assessment())
        with self.app.app_context():
            from app import get_db
            get_db().execute("UPDATE attempts SET deadline_at=? WHERE id=?",
                             (time.time() - 1, attempt["id"]))
            get_db().commit()
        response = self.client.put(f"/api/attempts/{attempt['id']}/responses",
                                   headers=self.auth(self.student_token),
                                   json={"question_id": attempt["questions"][0]["id"], "answer": "b"})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.get_json()["status"], "expired")

    def test_certificate_revocation_has_audit_and_changes_public_state(self):
        attempt = self.start_attempt(self.create_assessment())
        self.client.put(f"/api/attempts/{attempt['id']}/responses", headers=self.auth(self.student_token),
                        json={"question_id": attempt["questions"][0]["id"], "answer": "b"})
        self.client.post(f"/api/attempts/{attempt['id']}/submit", headers=self.auth(self.student_token))
        certificate_id = self.client.get("/api/results", headers=self.auth(self.student_token)).get_json()["items"][0]["certificate_id"]
        forbidden = self.client.post(f"/api/admin/certificates/{certificate_id}/revoke",
                                     headers=self.auth(self.student_token), json={"reason": "Issue"})
        self.assertEqual(forbidden.status_code, 403)
        revoked = self.client.post(f"/api/admin/certificates/{certificate_id}/revoke",
                                   headers=self.auth(self.admin_token), json={"reason": "Verified issue"})
        self.assertEqual(revoked.status_code, 200)
        verify = self.client.get(f"/api/certificates/verify/{certificate_id}").get_json()
        self.assertEqual(verify["status"], "revoked")
        self.assertEqual(self.client.get(f"/api/certificates/{certificate_id}/pdf").status_code, 410)

    def test_catalog_search_and_pagination(self):
        self.create_assessment()
        response = self.client.get("/api/assessments?search=Python&page=1&per_page=1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["total"], 1)


if __name__ == "__main__":
    unittest.main()
