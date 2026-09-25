import html

def render_file_card(path: str, entry: dict, limit: int = 4096) -> str:
    header = f"📄 <b>{html.escape(path)}</b>\n\n"

    raw_summary = entry.get("summary")
    if not raw_summary or not isinstance(raw_summary, str):
        body = "<i>Документация ещё не сгенерирована (вызови /generate).</i>"
    else:
        body = raw_summary

    if len(header) + len(body) > limit:
        body = body[:limit - len(header) - 20] + "\n…(обрезано)"

    return header + body