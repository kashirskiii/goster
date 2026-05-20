from pathlib import Path

import fitz  # PyMuPDF

from core.models import ParsedDocument, TextSpan
from core.toc_parser import extract_toc


class PDFParser:
    def parse(self, path: str | Path) -> ParsedDocument:
        path = str(path)
        doc = fitz.open(path)
        document = ParsedDocument(path=path, page_count=doc.page_count)

        for page_num, page in enumerate(doc, start=1):
            document.page_sizes[page_num] = (page.rect.width, page.rect.height)
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if block.get("type") != 0:  # 0 = text block
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        text = span.get("text", "").strip()
                        if not text:
                            continue
                        document.spans.append(
                            TextSpan(
                                text=text,
                                font=span.get("font", ""),
                                size=round(span.get("size", 0.0), 2),
                                color=span.get("color", 0),
                                bbox=tuple(span.get("bbox", (0, 0, 0, 0))),
                                page=page_num,
                            )
                        )

        document.toc = extract_toc(doc, document.page_sizes)
        doc.close()
        return document
