-- Migration to support Cloudinary-backed file storage
-- Run against your PostgreSQL database (psql or any SQL client)

ALTER TABLE stored_files
    ADD COLUMN IF NOT EXISTS url TEXT,
    ADD COLUMN IF NOT EXISTS cloudinary_public_id VARCHAR(255);

-- Allow NULL data because blobs are no longer stored in DB
ALTER TABLE stored_files
    ALTER COLUMN data DROP NOT NULL;
