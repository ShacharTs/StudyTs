-- CreateTable
CREATE TABLE "canvas_store_docs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "doc" JSONB NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "canvas_store_docs_key_key" ON "canvas_store_docs"("key");
