-- S4: catatan pekerjaan ekspor yang berjalan di latar
CREATE TABLE ekspor (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text NOT NULL DEFAULT 'BERJALAN'
                CHECK (status IN ('BERJALAN','SELESAI','GAGAL')),
  jumlah_baris  integer NOT NULL CHECK (jumlah_baris BETWEEN 1 AND 1000000),
  baris_ditulis integer NOT NULL DEFAULT 0,
  galat         text,
  dibuat_pada   timestamptz NOT NULL DEFAULT now(),
  selesai_pada  timestamptz
);
