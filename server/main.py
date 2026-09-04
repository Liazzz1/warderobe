import os
import time
import hmac
import hashlib
import json
import uuid
from urllib.parse import parse_qsl, unquote
from datetime import datetime
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor
from rembg import remove
from PIL import Image
import io

BOT_TOKEN = os.getenv("BOT_TOKEN", "YOUR_TELEGRAM_BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/wardrobe")

# Файлы храним локально на Railway Volume (без Cloudflare/S3).
# STORAGE_DIR должен указывать на путь, куда примонтирован Volume (например /data).
STORAGE_DIR = os.getenv("STORAGE_DIR", "/data")
ITEMS_DIR = os.path.join(STORAGE_DIR, "items")
os.makedirs(ITEMS_DIR, exist_ok=True)

# Публичный домен сервиса. Railway сам прокидывает RAILWAY_PUBLIC_DOMAIN
# (без схемы), если у сервиса включён публичный домен — используем его,
# иначе можно задать PUBLIC_URL вручную в переменных окружения.
_railway_domain = os.getenv("RAILWAY_PUBLIC_DOMAIN")
PUBLIC_URL = os.getenv("PUBLIC_URL") or (f"https://{_railway_domain}" if _railway_domain else "http://localhost:8000")

app = FastAPI(title="Wardrobe TMA Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Отдаём загруженные картинки напрямую как статику: /files/items/<tg_id>/<id>.png
app.mount("/files", StaticFiles(directory=STORAGE_DIR), name="files")

@app.get("/")
@app.get("/health")
def health_check():
    return {"status": "ok"}

def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

def _parse_and_verify_init_data(authorization: Optional[str]) -> dict:
    """Проверяет HMAC-подпись initData и возвращает распарсенный dict Telegram-юзера."""
    if not authorization or not authorization.startswith("tma "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    init_data_raw = authorization[4:]
    try:
        parsed_data = dict(parse_qsl(init_data_raw, keep_blank_values=True))
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed initData")

    if "hash" not in parsed_data:
        raise HTTPException(status_code=401, detail="Hash missing from initData")

    received_hash = parsed_data.pop("hash")
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))

    secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(status_code=401, detail="Invalid HMAC signature")

    auth_date = int(parsed_data.get("auth_date", 0))
    if auth_date > 0 and (time.time() - auth_date) > 86400:
        raise HTTPException(status_code=401, detail="initData expired (older than 24h)")

    user_dict = json.loads(unquote(parsed_data.get("user", "{}")))
    if not user_dict.get("id"):
        raise HTTPException(status_code=401, detail="initData has no user id")
    return user_dict

def _upsert_user(db, user_dict: dict) -> None:
    """Создаёт/обновляет запись в users, чтобы устройство было привязано к аккаунту Telegram."""
    tg_id = user_dict.get("id")
    first_name = user_dict.get("first_name") or ""
    username = user_dict.get("username")
    photo_url = user_dict.get("photo_url")
    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (id, telegram_id, first_name, username, photo_url)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (telegram_id) DO UPDATE SET
                first_name = EXCLUDED.first_name,
                username = EXCLUDED.username,
                photo_url = EXCLUDED.photo_url
            """,
            (str(tg_id), tg_id, first_name, username, photo_url)
        )
        db.commit()

def validate_telegram_init_data(
    authorization: Optional[str] = Header(None),
    db=Depends(get_db),
) -> dict:
    """Проверяет initData И привязывает/обновляет пользователя в БД (users) —
    это гарантия того, что любое устройство, зашедшее с этим Telegram-аккаунтом,
    видит один и тот же user_id и, соответственно, одни и те же вещи/образы."""
    user_dict = _parse_and_verify_init_data(authorization)
    _upsert_user(db, user_dict)
    return user_dict

# ----------------- Пользователь -----------------

@app.get("/me")
def get_me(user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = user.get("id")
    with db.cursor() as cur:
        cur.execute(
            'SELECT id, telegram_id AS "telegramId", first_name AS "firstName", '
            'username, photo_url AS "photoUrl", created_at AS "createdAt" '
            'FROM users WHERE telegram_id = %s',
            (tg_id,)
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return row

# ----------------- Вещи -----------------

@app.get("/items")
def list_items(category: Optional[str] = None, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        if category:
            cur.execute(
                'SELECT id, user_id AS "userId", category, color, brand, name, image_url AS "imageUrl", created_at AS "createdAt" '
                'FROM items WHERE user_id = %s AND category = %s ORDER BY created_at DESC',
                (tg_id, category)
            )
        else:
            cur.execute(
                'SELECT id, user_id AS "userId", category, color, brand, name, image_url AS "imageUrl", created_at AS "createdAt" '
                'FROM items WHERE user_id = %s ORDER BY created_at DESC',
                (tg_id,)
            )
        rows = cur.fetchall()
    return rows

@app.post("/items/upload")
async def upload_item(
    file: UploadFile = File(...),
    category: str = Form(...),
    color: str = Form(...),
    name: str = Form(...),
    brand: Optional[str] = Form(None),
    user: dict = Depends(validate_telegram_init_data),
    db=Depends(get_db),
):
    tg_id = str(user.get("id"))
    raw_bytes = await file.read()

    try:
        input_image = Image.open(io.BytesIO(raw_bytes))
        has_transparency = False
        if input_image.mode in ("RGBA", "LA") or (input_image.mode == "P" and "transparency" in input_image.info):
            extrema = input_image.convert("RGBA").getextrema()
            if extrema[3][0] < 250:
                has_transparency = True

        if not has_transparency:
            output_image = remove(input_image)
        else:
            output_image = input_image
    except Exception:
        output_image = Image.open(io.BytesIO(raw_bytes))

    out_bytes = io.BytesIO()
    output_image.save(out_bytes, format="PNG", optimize=True)
    out_bytes.seek(0)

    item_id = str(uuid.uuid4())
    user_dir = os.path.join(ITEMS_DIR, tg_id)
    os.makedirs(user_dir, exist_ok=True)
    file_path = os.path.join(user_dir, f"{item_id}.png")
    with open(file_path, "wb") as f:
        f.write(out_bytes.read())

    image_url = f"{PUBLIC_URL}/files/items/{tg_id}/{item_id}.png"

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO items (id, user_id, category, color, brand, name, image_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id AS "userId", category, color, brand, name, image_url AS "imageUrl", created_at AS "createdAt";
            """,
            (item_id, tg_id, category, color, brand, name, image_url, datetime.utcnow())
        )
        saved_item = cur.fetchone()
        db.commit()

    return saved_item

@app.delete("/items/{item_id}")
def delete_item(item_id: str, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        cur.execute("DELETE FROM items WHERE id = %s AND user_id = %s", (item_id, tg_id))
        db.commit()
    file_path = os.path.join(ITEMS_DIR, tg_id, f"{item_id}.png")
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
    except OSError:
        pass
    return {"status": "ok"}

# ----------------- Образы -----------------

class SaveLookRequest(BaseModel):
    name: str
    layers: List[dict]
    previewUrl: Optional[str] = None
    folderId: Optional[str] = None

class MoveLookRequest(BaseModel):
    folderId: Optional[str] = None

@app.get("/looks")
def list_looks(user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id AS "userId", name, layers, preview_url AS "previewUrl",
                   folder_id AS "folderId", created_at AS "createdAt"
            FROM looks WHERE user_id = %s ORDER BY created_at DESC
            """,
            (tg_id,)
        )
        rows = cur.fetchall()
    return rows

@app.post("/looks")
def save_look(body: SaveLookRequest, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    look_id = str(uuid.uuid4())

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO looks (id, user_id, name, layers, preview_url, folder_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, user_id AS "userId", name, layers, preview_url AS "previewUrl",
                      folder_id AS "folderId", created_at AS "createdAt";
            """,
            (look_id, tg_id, body.name, json.dumps(body.layers), body.previewUrl, body.folderId, datetime.utcnow())
        )
        saved_look = cur.fetchone()
        db.commit()

    return saved_look

@app.patch("/looks/{look_id}")
def move_look(look_id: str, body: MoveLookRequest, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        cur.execute(
            """
            UPDATE looks SET folder_id = %s
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id AS "userId", name, layers, preview_url AS "previewUrl",
                      folder_id AS "folderId", created_at AS "createdAt";
            """,
            (body.folderId, look_id, tg_id)
        )
        updated = cur.fetchone()
        db.commit()
    if not updated:
        raise HTTPException(status_code=404, detail="Look not found")
    return updated

@app.delete("/looks/{look_id}")
def delete_look(look_id: str, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        cur.execute("DELETE FROM looks WHERE id = %s AND user_id = %s", (look_id, tg_id))
        db.commit()
    return {"status": "ok"}

# ----------------- Папки -----------------

class CreateFolderRequest(BaseModel):
    name: str
    parentId: Optional[str] = None

@app.get("/folders")
def list_folders(user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        cur.execute(
            """
            SELECT id, user_id AS "userId", name, parent_id AS "parentId", created_at AS "createdAt"
            FROM folders WHERE user_id = %s ORDER BY created_at DESC
            """,
            (tg_id,)
        )
        rows = cur.fetchall()
    return rows

@app.post("/folders")
def create_folder(body: CreateFolderRequest, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    folder_id = str(uuid.uuid4())

    with db.cursor() as cur:
        cur.execute(
            """
            INSERT INTO folders (id, user_id, name, parent_id, created_at)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, user_id AS "userId", name, parent_id AS "parentId", created_at AS "createdAt";
            """,
            (folder_id, tg_id, body.name, body.parentId, datetime.utcnow())
        )
        saved_folder = cur.fetchone()
        db.commit()

    return saved_folder

@app.delete("/folders/{folder_id}")
def delete_folder(folder_id: str, user: dict = Depends(validate_telegram_init_data), db=Depends(get_db)):
    tg_id = str(user.get("id"))
    with db.cursor() as cur:
        cur.execute("DELETE FROM folders WHERE id = %s AND user_id = %s", (folder_id, tg_id))
        db.commit()
    return {"status": "ok"}