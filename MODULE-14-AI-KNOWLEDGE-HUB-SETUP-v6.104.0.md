# Module 14 — AI Knowledge Hub setup

1. Open the workspace AI Growth Control Center and its Assistant / Knowledge Hub panel.
2. Connect an OpenAI credential in the workspace Integrations settings. Scanned PDF and image OCR requires this connection (or the configured server `OPENAI_API_KEY`) and consumes the workspace `ai_messages` quota.
3. Upload TXT, CSV, Markdown, PDF, DOCX, XLSX, JPG, JPEG, PNG or WEBP files (maximum 10 MiB each).
4. Text-based PDFs and office/text formats use native extraction. Scanned PDFs and image files use OCR. The document list shows `native` or `ocr` extraction and the OCR model used.
5. Configure OpenAI embeddings to enable semantic retrieval. If embeddings are unavailable, documents remain searchable using PostgreSQL full-text search. Use “Re-index missing embeddings” to retry bounded batches.
6. Use “Ask Knowledge Hub” to generate source-grounded answers. Answers require a retrieved source and a quote validated against the source excerpt.
7. For retrieval evaluation, prepare up to 20 JSON test cases. Each case requires `query` and `expectedDocumentIds`. Copy document IDs from the workspace document list. Every expected ID must belong to the current workspace.
8. Review Hit Rate@8, Mean Reciprocal Rank@8 and Mean Recall@8. These measure retrieval ranking against supplied labels; they do not measure factual answer correctness.

OCR does not guarantee recovery from blurred, rotated, low-resolution or handwriting-heavy scans. Review extracted text and source documents before using high-impact facts, prices or policies.
