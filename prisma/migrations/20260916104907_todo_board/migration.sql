-- AlterTable
ALTER TABLE "todo_items" ADD COLUMN     "color" TEXT,
ADD COLUMN     "pin" TEXT,
ADD COLUMN     "shared" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "x" DOUBLE PRECISION,
ADD COLUMN     "y" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "todo_items_shared_createdById_idx" ON "todo_items"("shared", "createdById");
