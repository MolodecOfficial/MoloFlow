// server/utils/moloDb/pythonClient.ts
//
// Исходник moloflow_db.py. Демон Python-модуля кладёт его рядом с кодом бота,
// поэтому в боте достаточно написать:  from moloflow_db import db
// Только стандартная библиотека — ставить ничего не нужно.
export const PY_CLIENT_SOURCE = `# moloflow_db.py — клиент мини-баз MoloFlow (создаётся автоматически, править не нужно)
#
#   from moloflow_db import db
#
#   msgs = db("botlog").messages                  # или db("botlog").collection("messages")
#   msgs.insert({"text": "привет", "kind": "text"})
#   rows = msgs.find({"kind": "text"}, sort="-createdAt", limit=20)
#
#   # внутри async-кода (aiogram) используйте версии с буквой a — они не блокируют цикл:
#   await msgs.ainsert({"text": "привет"})
#   rows = await msgs.afind({"kind": "text"}, limit=20)
import asyncio
import json
import os
import urllib.error
import urllib.request


class MoloDBError(Exception):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


class Collection:
    def __init__(self, client, db, name):
        self._client = client
        self._db = db
        self._name = name

    def _call(self, body):
        return self._client._request(self._db, self._name, body)

    @staticmethod
    def _target(t):
        return {"id": t} if isinstance(t, str) else {"filter": t or {}}

    # ── чтение ──
    def find(self, filter=None, sort=None, limit=50, skip=0, search=None):
        body = {"op": "find", "filter": filter or {}, "limit": limit, "skip": skip, "withTotal": False}
        if sort:
            body["sort"] = sort
        if search:
            body["search"] = search
        return self._call(body)["items"]

    def page(self, filter=None, sort=None, limit=50, skip=0, search=None):
        body = {"op": "find", "filter": filter or {}, "limit": limit, "skip": skip}
        if sort:
            body["sort"] = sort
        if search:
            body["search"] = search
        r = self._call(body)
        return {"items": r["items"], "total": r.get("total"), "limit": r["limit"], "skip": r["skip"]}

    def find_one(self, filter=None, sort=None):
        body = {"op": "findOne", "filter": filter or {}}
        if sort:
            body["sort"] = sort
        return self._call(body)["item"]

    def get(self, id):
        return self._call({"op": "get", "id": id})["item"]

    def count(self, filter=None):
        return self._call({"op": "count", "filter": filter or {}})["count"]

    # ── запись ──
    def insert(self, doc):
        return self._call({"op": "insert", "doc": doc})["item"]

    def insert_many(self, docs):
        return self._call({"op": "insertMany", "docs": docs})["items"]

    def update(self, target, patch=None, inc=None, unset=None, many=False, upsert=False):
        body = {"op": "update", "patch": patch or {}, "many": many, "upsert": upsert, **self._target(target)}
        if inc:
            body["inc"] = inc
        if unset:
            body["unset"] = unset
        r = self._call(body)
        r.pop("success", None)
        return r

    def delete(self, target, many=False):
        r = self._call({"op": "delete", "many": many, **self._target(target)})
        r.pop("success", None)
        return r

    def clear(self):
        r = self._call({"op": "delete", "filter": {}, "many": True, "all": True})
        r.pop("success", None)
        return r

    # ── async-версии: тот же вызов, но в потоке, чтобы не блокировать asyncio ──
    async def afind(self, *a, **k):
        return await asyncio.to_thread(self.find, *a, **k)

    async def apage(self, *a, **k):
        return await asyncio.to_thread(self.page, *a, **k)

    async def afind_one(self, *a, **k):
        return await asyncio.to_thread(self.find_one, *a, **k)

    async def aget(self, *a, **k):
        return await asyncio.to_thread(self.get, *a, **k)

    async def acount(self, *a, **k):
        return await asyncio.to_thread(self.count, *a, **k)

    async def ainsert(self, *a, **k):
        return await asyncio.to_thread(self.insert, *a, **k)

    async def ainsert_many(self, *a, **k):
        return await asyncio.to_thread(self.insert_many, *a, **k)

    async def aupdate(self, *a, **k):
        return await asyncio.to_thread(self.update, *a, **k)

    async def adelete(self, *a, **k):
        return await asyncio.to_thread(self.delete, *a, **k)


class Database:
    def __init__(self, client, name):
        self._client = client
        self._name = name

    def collection(self, name):
        return Collection(self._client, self._name, name)

    __getitem__ = collection

    def __getattr__(self, name):
        if name.startswith("_"):
            raise AttributeError(name)
        return self.collection(name)


class MoloDB:
    def __init__(self, url=None, token=None, enterprise=None):
        self.url = (url or os.environ.get("MOLO_API_URL") or "http://127.0.0.1:3000").rstrip("/")
        self.token = token or os.environ.get("MOLO_DB_TOKEN", "")
        self.enterprise = enterprise or os.environ.get("MOLO_ENTERPRISE_ID", "")

    def __call__(self, name):
        return Database(self, name)

    def _request(self, db, col, body):
        if not self.enterprise or not self.token:
            raise MoloDBError("MoloDB не настроена: нет MOLO_ENTERPRISE_ID / MOLO_DB_TOKEN (бот запущен не из MoloFlow?)")
        req = urllib.request.Request(
            f"{self.url}/api/enterprises/{self.enterprise}/moloDb/{db}/{col}",
            data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json", "x-molo-db-token": self.token},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                data = json.loads(e.read().decode("utf-8"))
                message = data.get("message") or data.get("statusMessage") or str(e)
            except Exception:
                message = str(e)
            raise MoloDBError(message, e.code) from None
        except urllib.error.URLError as e:
            raise MoloDBError(f"Нет связи с MoloFlow: {e.reason}") from None


db = MoloDB()
`