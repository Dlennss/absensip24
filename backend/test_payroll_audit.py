import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "payroll_audit_tests_not_connected")

from bson import ObjectId

import server


class Cursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, field, direction=None):
        if isinstance(field, list):
            for key, order in reversed(field):
                self.documents.sort(key=lambda doc: doc.get(key, ""), reverse=order < 0)
        else:
            self.documents.sort(key=lambda doc: doc.get(field, ""), reverse=direction == -1)
        return self

    async def to_list(self, length):
        return self.documents[:length]


class AdjustmentCollection:
    def __init__(self):
        self.documents = {}

    async def insert_one(self, doc):
        inserted_id = ObjectId()
        self.documents[inserted_id] = {**doc, "_id": inserted_id}
        return SimpleNamespace(inserted_id=inserted_id)

    async def find_one(self, query):
        doc = self.documents.get(query.get("_id"))
        if not doc:
            return None
        if query.get("is_deleted", {}).get("$ne") is True and doc.get("is_deleted") is True:
            return None
        return dict(doc)

    async def update_one(self, query, update):
        doc = self.documents.get(query.get("_id"))
        if not doc or (query.get("is_deleted", {}).get("$ne") is True and doc.get("is_deleted") is True):
            return SimpleNamespace(matched_count=0)
        doc.update(update.get("$set", {}))
        for key in update.get("$unset", {}):
            doc.pop(key, None)
        return SimpleNamespace(matched_count=1)

    async def delete_one(self, query):
        deleted = self.documents.pop(query.get("_id"), None)
        return SimpleNamespace(deleted_count=int(deleted is not None))

    def find(self, query):
        month = query.get("month")
        docs = [doc for doc in self.documents.values() if doc["month"] == month and not doc.get("is_deleted")]
        return Cursor(docs)


class AuditCollection:
    def __init__(self, fail=False):
        self.documents = []
        self.fail = fail

    async def insert_one(self, doc):
        if self.fail:
            raise RuntimeError("audit storage unavailable")
        saved = {**doc, "_id": ObjectId()}
        self.documents.append(saved)
        return SimpleNamespace(inserted_id=saved["_id"])

    def find(self, query):
        return Cursor([
            doc for doc in self.documents
            if doc["month"] == query["month"] and doc["name_lower"] == query["name_lower"]
        ])


class PayrollAuditTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.adjustments = AdjustmentCollection()
        self.audit = AuditCollection()
        self.database = SimpleNamespace(
            salary_adjustments=self.adjustments,
            salary_adjustment_audit=self.audit,
        )

    async def test_adjustment_crud_is_audited_and_delete_is_archived(self):
        marketing = {"name": "Asep", "name_lower": "asep"}
        admin = {"email": "admin@example.com"}
        input_data = server.SalaryAdjustmentInput(
            name="Asep", month="2026-11", amount=100000, note="Bonus", kind="other"
        )
        with patch.object(server, "db", self.database), patch.object(
            server, "require_registered_marketing", AsyncMock(return_value=marketing)
        ):
            created = await server.create_salary_adjustment(input_data, admin)
            changed = await server.update_salary_adjustment(
                created["id"],
                server.SalaryAdjustmentInput(
                    name="Asep", month="2026-11", amount=50000, note="Koreksi", kind="other"
                ),
                admin,
            )
            archived = await server.delete_salary_adjustment(created["id"], admin)
            visible = await server.list_salary_adjustments("2026-11", admin)
            history = await server.list_salary_adjustment_audit("2026-11", "Asep", admin)

        self.assertEqual(created["amount"], 100000)
        self.assertEqual(changed["amount"], 50000)
        self.assertIn("diarsipkan", archived["message"])
        self.assertEqual(visible, [])
        self.assertEqual([event["action"] for event in history], ["deleted", "updated", "created"])
        self.assertEqual(history[1]["actor_email"], "admin@example.com")
        self.assertEqual(history[1]["before"]["amount"], 100000)
        self.assertEqual(history[1]["after"]["amount"], 50000)
        self.assertIsNone(history[0]["after"])
        self.assertTrue(next(iter(self.adjustments.documents.values()))["is_deleted"])

    async def test_creation_rolls_back_if_audit_cannot_be_written(self):
        self.database.salary_adjustment_audit = AuditCollection(fail=True)
        input_data = server.SalaryAdjustmentInput(
            name="Asep", month="2026-11", amount=100000, note="Bonus", kind="other"
        )
        with patch.object(server, "db", self.database), patch.object(
            server, "require_registered_marketing", AsyncMock(return_value={"name": "Asep", "name_lower": "asep"})
        ):
            with self.assertRaises(RuntimeError):
                await server.create_salary_adjustment(input_data, {"email": "admin@example.com"})
        self.assertEqual(self.adjustments.documents, {})

    async def test_missing_attendance_uses_only_active_names_not_present_today(self):
        marketers = [
            {"name": "Belum Hadir", "name_lower": "belum hadir"},
            {"name": "Sudah Hadir", "name_lower": "sudah hadir"},
        ]
        def find(query, projection):
            attended = query["name_lower"]["$nin"]
            return Cursor([doc for doc in marketers if doc["name_lower"] not in attended])

        marketing_collection = SimpleNamespace(find=Mock(side_effect=find))
        attendance_collection = SimpleNamespace(distinct=AsyncMock(return_value=["sudah hadir"]))
        database = SimpleNamespace(marketing=marketing_collection, attendance=attendance_collection)
        with patch.object(server, "db", database):
            result = await server.list_missing_attendance({"email": "admin@example.com"})
        self.assertEqual(result["names"], ["Belum Hadir"])
        self.assertEqual(marketing_collection.find.call_args.args[0]["name_lower"]["$nin"], ["sudah hadir"])


if __name__ == "__main__":
    unittest.main()
