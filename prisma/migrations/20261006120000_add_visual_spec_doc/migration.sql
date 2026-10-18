-- CreateTable
CREATE TABLE "visual_spec_docs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "visual_spec_docs_key_key" ON "visual_spec_docs"("key");
