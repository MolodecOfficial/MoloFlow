from services.store import store


def render_file_card(rel_path: str, entry: dict) -> str:
    summary = (entry or {}).get("summary") or "<i>Описание ещё не готово</i>"
    header = f"📄 <b>{rel_path}</b>\n{'─' * 24}\n\n"
    body = summary
    limit = 4000
    if len(header) + len(body) > limit:
        body = body[: limit - len(header) - 20] + "\n…"
    return header + body