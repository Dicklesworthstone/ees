#!/usr/bin/env python3
import json
import pathlib
import re
import sqlite3
from collections import Counter

import brotli

from datasets import load_dataset
from email import policy
from email.parser import Parser
from email.utils import getaddresses
from dateutil import parser as dateparser


DATA_DIR = pathlib.Path("data")
META_DB_PATH = DATA_DIR / "meta.sqlite"
TEXT_PACK_PATH = DATA_DIR / "text.pack"

MAX_CHARS_PER_CHUNK = 8000
MAX_LINES_PER_CHUNK = 250


def split_header_body(text):
    parts = re.split(r"\n\s*\n", text, maxsplit=1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return "", text


def parse_headers(header_text):
    parser = Parser(policy=policy.default)
    msg = parser.parsestr(header_text)
    meta = {
        "subject": msg.get("Subject"),
        "from": msg.get("From"),
        "to": msg.get("To"),
        "cc": msg.get("Cc"),
        "bcc": msg.get("Bcc"),
        "date_raw": msg.get("Date") or msg.get("Sent"),
        "message_id": msg.get("Message-ID"),
        "in_reply_to": msg.get("In-Reply-To"),
        "references": msg.get("References"),
    }
    return meta


def normalize_subject(subj):
    if not subj:
        return None
    s = subj.strip()
    s_clean = re.sub(r"^\s*(re|fw|fwd)\s*:\s*", "", s, flags=re.IGNORECASE)
    if not s_clean:
        s_clean = s
    return s_clean


def parse_date(date_str):
    if not date_str:
        return None, None
    try:
        dt = dateparser.parse(date_str)
    except Exception:
        return None, None
    if not dt:
        return None, None
    if not dt.tzinfo:
        dt = dt.replace(tzinfo=None)
    iso = dt.isoformat()
    date_key = dt.date().isoformat()
    return iso, date_key


def extract_addresses(value):
    if not value:
        return []
    addrs = []
    for name, addr in getaddresses([value]):
        addr = addr.strip()
        name = name.strip()
        if not addr:
            continue
        addr_lower = addr.lower()
        addrs.append((name or None, addr_lower))
    return addrs


def chunk_text(text):
    lines = text.splitlines()
    chunks = []
    current_lines = []
    current_len = 0

    def flush():
        nonlocal current_lines, current_len
        if current_lines:
            chunks.append("\n".join(current_lines).strip("\n"))
            current_lines = []
            current_len = 0

    sep_re = re.compile(r"^(={5,}|-{5,})\s*$")
    for line in lines:
        if sep_re.match(line):
            flush()
            continue
        current_lines.append(line)
        current_len += len(line) + 1
        if current_len >= MAX_CHARS_PER_CHUNK or len(current_lines) >= MAX_LINES_PER_CHUNK:
            flush()
    flush()
    if not chunks:
        chunks.append(text)
    return chunks


def build():
    DATA_DIR.mkdir(exist_ok=True)
    if META_DB_PATH.exists():
        META_DB_PATH.unlink()
    if TEXT_PACK_PATH.exists():
        TEXT_PACK_PATH.unlink()

    print("Loading Epstein dataset...")
    ds = load_dataset("tensonaut/EPSTEIN_FILES_20K", split="train")

    messages = []
    timeline_counts = Counter()
    people = {}

    def get_person_stats(addr):
        if addr not in people:
            people[addr] = {
                "address": addr,
                "display_names": set(),
                "domain": addr.split("@", 1)[1] if "@" in addr else None,
                "message_count": 0,
                "sent_count": 0,
                "received_count": 0,
                "first_date": None,
                "last_date": None,
                "co_counts": Counter(),
            }
        return people[addr]

    # Pass 1: messages + people + timeline
    for row_idx, row in enumerate(ds):
        filename = row["filename"]
        raw_text = row["text"] or ""
        kind = "OTHER"
        if "-" in filename:
            kind = filename.split("-", 1)[0] or "OTHER"
        elif "_" in filename:
            kind = filename.split("_", 1)[0] or "OTHER"

        header_text, body_text = split_header_body(raw_text)
        hdr = parse_headers(header_text)
        subject = hdr["subject"]
        from_raw = hdr["from"]
        to_raw = hdr["to"]
        cc_raw = hdr["cc"]
        bcc_raw = hdr["bcc"]

        date_iso, date_key = parse_date(hdr["date_raw"])

        from_addrs = extract_addresses(from_raw)
        to_addrs = extract_addresses(to_raw)
        cc_addrs = extract_addresses(cc_raw)
        bcc_addrs = extract_addresses(bcc_raw)

        participants = []
        seen_addr = set()
        for name, addr in from_addrs + to_addrs + cc_addrs + bcc_addrs:
            if addr not in seen_addr:
                seen_addr.add(addr)
                participants.append(addr)

        domains = sorted({addr.split("@", 1)[1] for addr in participants if "@" in addr})

        if date_key:
            timeline_counts[date_key] += 1

        for name, addr in from_addrs:
            stats = get_person_stats(addr)
            stats["message_count"] += 1
            stats["sent_count"] += 1
            if date_key:
                if not stats["first_date"] or date_key < stats["first_date"]:
                    stats["first_date"] = date_key
                if not stats["last_date"] or date_key > stats["last_date"]:
                    stats["last_date"] = date_key
            if name:
                stats["display_names"].add(name)
        for name, addr in to_addrs + cc_addrs + bcc_addrs:
            stats = get_person_stats(addr)
            stats["message_count"] += 1
            stats["received_count"] += 1
            if date_key:
                if not stats["first_date"] or date_key < stats["first_date"]:
                    stats["first_date"] = date_key
                if not stats["last_date"] or date_key > stats["last_date"]:
                    stats["last_date"] = date_key
            if name:
                stats["display_names"].add(name)

        for a in participants:
            sa = get_person_stats(a)
            for b in participants:
                if b == a:
                    continue
                sa["co_counts"][b] += 1

        subj_norm = normalize_subject(subject)
        thread_key = None
        if subj_norm and participants:
            thread_key = (subj_norm.lower(), tuple(sorted(participants)))

        msg = {
            "message_id": f"m{row_idx}",
            "row_index": row_idx,
            "filename": filename,
            "kind": kind,
            "raw_text": raw_text,
            "body_text": body_text,
            "subject": subject,
            "from_raw": from_raw,
            "to_raw": to_raw,
            "cc_raw": cc_raw,
            "bcc_raw": bcc_raw,
            "from_addrs": [a for (_, a) in from_addrs],
            "to_addrs": [a for (_, a) in to_addrs],
            "cc_addrs": [a for (_, a) in cc_addrs],
            "bcc_addrs": [a for (_, a) in bcc_addrs],
            "participants": participants,
            "domains": domains,
            "date": date_iso,
            "date_key": date_key,
            "thread_key": thread_key,
            "normalized_subject": subj_norm,
        }
        messages.append(msg)

    # Thread assignment (very simple subject+participants grouping)
    thread_id_by_key = {}
    threads_info = {}
    if messages:
        ordered = sorted(
            messages,
            key=lambda m: (m["thread_key"] or ("", ()), m["date_key"] or "9999-12-31", m["row_index"]),
        )
        thread_seq = 0
        for msg in ordered:
            key = msg["thread_key"]
            dk = msg["date_key"]
            if not key:
                continue
            tid = thread_id_by_key.get(key)
            if not tid:
                thread_seq += 1
                tid = f"t{thread_seq}"
                thread_id_by_key[key] = tid
                threads_info[tid] = {
                    "thread_id": tid,
                    "normalized_subject": key[0],
                    "participants": list(key[1]),
                    "message_ids": [],
                    "kinds": set(),
                    "start_date": dk,
                    "end_date": dk,
                }
            info = threads_info[tid]
            info["message_ids"].append(msg["message_id"])
            info["kinds"].add(msg["kind"])
            if dk:
                if not info["start_date"] or dk < info["start_date"]:
                    info["start_date"] = dk
                if not info["end_date"] or dk > info["end_date"]:
                    info["end_date"] = dk
            msg["thread_id"] = tid

    # Build SQLite bundle
    conn = sqlite3.connect(META_DB_PATH)
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("PRAGMA temp_store=MEMORY")

    conn.execute(
        """
        CREATE TABLE docs (
            id INTEGER PRIMARY KEY,
            message_id TEXT,
            chunk_index INTEGER,
            chunk_count INTEGER,
            filename TEXT,
            kind TEXT,
            subject TEXT,
            `from` TEXT,
            `to` TEXT,
            cc TEXT,
            bcc TEXT,
            participants TEXT,
            domains TEXT,
            date TEXT,
            date_key TEXT,
            thread_id TEXT,
            preview TEXT,
            text_offset INTEGER,
            text_length INTEGER,
            compression TEXT,
            text_bytes INTEGER
        )
        """
    )

    conn.execute(
        "CREATE TABLE timeline (date TEXT PRIMARY KEY, count INTEGER NOT NULL)"
    )
    conn.execute(
        """
        CREATE TABLE people (
            address TEXT PRIMARY KEY,
            display_name TEXT,
            domain TEXT,
            message_count INTEGER,
            sent_count INTEGER,
            received_count INTEGER,
            first_date TEXT,
            last_date TEXT,
            top_co TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE threads (
            thread_id TEXT PRIMARY KEY,
            normalized_subject TEXT,
            participants TEXT,
            message_ids TEXT,
            kinds TEXT,
            start_date TEXT,
            end_date TEXT
        )
        """
    )

    doc_rows = []
    doc_id_seq = 0
    text_offset = 0
    with open(TEXT_PACK_PATH, "wb") as pack_f:
        for msg in messages:
            chunks = chunk_text(msg["body_text"] or msg["raw_text"])
            chunk_count = len(chunks)
            for chunk_index, chunk_text_value in enumerate(chunks):
                doc_id_seq += 1
                preview = " ".join(chunk_text_value.split())
                if len(preview) > 400:
                    preview = preview[:400]
                    last_space = preview.rfind(" ")
                    if last_space > 40:
                        preview = preview[:last_space]
                    preview += "…"

                raw_bytes = chunk_text_value.encode("utf-8", "ignore")
                compressed = brotli.compress(raw_bytes, quality=6)
                pack_f.write(compressed)
                start = text_offset
                length = len(compressed)
                text_offset += length

                doc_rows.append(
                    (
                        doc_id_seq,
                        msg["message_id"],
                        chunk_index,
                        chunk_count,
                        msg["filename"],
                        msg["kind"],
                        msg["subject"],
                        msg["from_raw"],
                        msg["to_raw"],
                        msg["cc_raw"],
                        msg["bcc_raw"],
                        json.dumps(msg["participants"]),
                        json.dumps(msg["domains"]),
                        msg["date"],
                        msg["date_key"],
                        msg.get("thread_id"),
                        preview,
                        start,
                        length,
                        "br",
                        len(raw_bytes),
                    )
                )

    conn.executemany(
        """
        INSERT INTO docs (
            id, message_id, chunk_index, chunk_count, filename, kind,
            subject, `from`, `to`, cc, bcc, participants, domains,
            date, date_key, thread_id, preview, text_offset, text_length, compression, text_bytes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        doc_rows,
    )

    if timeline_counts:
        timeline_rows = [(d, timeline_counts[d]) for d in sorted(timeline_counts.keys())]
        conn.executemany("INSERT INTO timeline (date, count) VALUES (?, ?)", timeline_rows)

    people_records = []
    for addr, stats in people.items():
        display_name = None
        if stats["display_names"]:
            display_name = sorted(stats["display_names"], key=lambda x: (len(x), x.lower()))[0]
        top_co = [
            {"address": other, "count": count}
            for other, count in stats["co_counts"].most_common(25)
        ]
        people_records.append(
            (
                addr,
                display_name,
                stats["domain"],
                int(stats["message_count"]),
                int(stats["sent_count"]),
                int(stats["received_count"]),
                stats["first_date"],
                stats["last_date"],
                json.dumps(top_co),
            )
        )
    people_records.sort(key=lambda p: (-p[3], p[0]))
    conn.executemany(
        """
        INSERT INTO people (
            address, display_name, domain, message_count, sent_count,
            received_count, first_date, last_date, top_co
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        people_records,
    )

    thread_records = []
    for tid, info in threads_info.items():
        thread_records.append(
            (
                tid,
                info["normalized_subject"],
                json.dumps(info["participants"]),
                json.dumps(info["message_ids"]),
                json.dumps(sorted(info["kinds"])),
                info["start_date"],
                info["end_date"],
            )
        )
    thread_records.sort(key=lambda t: (t[5] or "9999-12-31", t[0]))
    conn.executemany(
        """
        INSERT INTO threads (
            thread_id, normalized_subject, participants, message_ids, kinds,
            start_date, end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        thread_records,
    )

    conn.commit()
    conn.close()

    print(f"Wrote {len(doc_rows)} chunks into {META_DB_PATH} and {TEXT_PACK_PATH}")


if __name__ == "__main__":
    build()
