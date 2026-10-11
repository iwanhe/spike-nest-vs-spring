package id.kcsi.spike.ekspor;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import javax.sql.DataSource;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

// S4: ekspor besar sebagai pekerjaan latar.
// Baris dibaca dari PostgreSQL lewat kursor dan langsung ditulis ke file,
// jadi memori tidak tumbuh sebanding jumlah baris.
@Service
public class EksporService {
  private static final Logger log = LoggerFactory.getLogger(EksporService.class);

  // Hanya data historis, supaya isi file selalu sama dan bisa dibandingkan antar-kandidat.
  private static final String SQL_EKSPOR = """
      SELECT nomor, pemohon, pemasok, status, total::text AS total,
             to_char(dibuat_pada AT TIME ZONE 'Asia/Jakarta', 'YYYY-MM-DD') AS tanggal
        FROM pengajuan
       WHERE nomor LIKE 'HIST-%'
       ORDER BY nomor
       LIMIT ?""";
  private static final String[] KOLOM = {"nomor", "pemohon", "pemasok", "status", "total", "tanggal"};
  private static final int KOLOM_TOTAL = 4;

  private final JdbcTemplate jdbc;
  private final JdbcTemplate arus;
  private final TransactionTemplate transaksi;
  private final Path folder;
  private final Map<UUID, Integer> kemajuan = new ConcurrentHashMap<>();
  private final ExecutorService pelaksana = Executors.newFixedThreadPool(2);

  public EksporService(
      JdbcTemplate jdbc,
      DataSource dataSource,
      PlatformTransactionManager pengelolaTransaksi,
      @Value("${EKSPOR_DIR:ekspor-keluar}") String folder) {
    this.jdbc = jdbc;
    // Kursor PostgreSQL hanya aktif bila ada ukuran ambil dan query berjalan di dalam transaksi.
    this.arus = new JdbcTemplate(dataSource);
    this.arus.setFetchSize(1000);
    this.transaksi = new TransactionTemplate(pengelolaTransaksi);
    this.folder = Path.of(folder).toAbsolutePath();
  }

  public Path berkas(UUID id, String jenis) {
    return folder.resolve(id + "." + jenis);
  }

  public UUID mulai(int jumlahBaris) {
    UUID id = jdbc.queryForObject(
        "INSERT INTO ekspor (jumlah_baris) VALUES (?) RETURNING id", UUID.class, jumlahBaris);
    // Permintaan langsung dijawab 202; pekerjaan berjalan di thread lain.
    pelaksana.submit(() -> jalankan(id, jumlahBaris));
    return id;
  }

  public Map<String, Object> status(UUID id) {
    List<Map<String, Object>> baris = jdbc.queryForList(
        "SELECT status, jumlah_baris, baris_ditulis, galat FROM ekspor WHERE id = ?", id);
    if (baris.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    Map<String, Object> p = baris.get(0);
    Map<String, Object> hasil = new LinkedHashMap<>();
    hasil.put("idPekerjaan", id.toString());
    hasil.put("status", p.get("status"));
    hasil.put("jumlahBaris", p.get("jumlah_baris"));
    hasil.put("barisDitulis", kemajuan.getOrDefault(id, ((Number) p.get("baris_ditulis")).intValue()));
    hasil.put("galat", p.get("galat"));
    return hasil;
  }

  public void pastikanSelesai(UUID id) {
    if (!"SELESAI".equals(status(id).get("status"))) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Ekspor belum selesai");
    }
  }

  private static String csv(String nilai) {
    if (nilai.contains(",") || nilai.contains("\"") || nilai.contains("\n")) {
      return "\"" + nilai.replace("\"", "\"\"") + "\"";
    }
    return nilai;
  }

  private void jalankan(UUID id, int jumlahBaris) {
    int[] ditulis = {0};
    try {
      Files.createDirectories(folder);
      transaksi.executeWithoutResult(status -> {
        try (BufferedWriter berkasCsv = Files.newBufferedWriter(berkas(id, "csv"), StandardCharsets.UTF_8);
            SXSSFWorkbook buku = new SXSSFWorkbook(100)) { // hanya 100 baris Excel yang ditahan di memori
          Sheet lembar = buku.createSheet("Pengajuan");
          berkasCsv.write(String.join(",", KOLOM));
          berkasCsv.write('\n');
          Row judul = lembar.createRow(0);
          for (int i = 0; i < KOLOM.length; i++) judul.createCell(i).setCellValue(KOLOM[i]);

          arus.query(SQL_EKSPOR, (RowCallbackHandler) rs -> {
            Row baris = lembar.createRow(ditulis[0] + 1);
            StringBuilder teks = new StringBuilder();
            for (int i = 0; i < KOLOM.length; i++) {
              String nilai = rs.getString(i + 1);
              if (i > 0) teks.append(',');
              teks.append(csv(nilai));
              if (i == KOLOM_TOTAL) baris.createCell(i).setCellValue(Double.parseDouble(nilai));
              else baris.createCell(i).setCellValue(nilai);
            }
            teks.append('\n');
            try {
              berkasCsv.write(teks.toString());
            } catch (IOException e) {
              throw new UncheckedIOException(e);
            }
            ditulis[0]++;
            if (ditulis[0] % 1000 == 0) kemajuan.put(id, ditulis[0]);
          }, jumlahBaris);

          berkasCsv.flush();
          try (OutputStream keluar = Files.newOutputStream(berkas(id, "xlsx"))) {
            buku.write(keluar);
          }
        } catch (IOException e) {
          throw new UncheckedIOException(e);
        }
      });
      jdbc.update(
          "UPDATE ekspor SET status = 'SELESAI', baris_ditulis = ?, selesai_pada = now() WHERE id = ?",
          ditulis[0], id);
    } catch (Exception e) {
      log.error("Ekspor {} gagal", id, e);
      jdbc.update(
          "UPDATE ekspor SET status = 'GAGAL', baris_ditulis = ?, galat = ?, selesai_pada = now() WHERE id = ?",
          ditulis[0], String.valueOf(e.getMessage()), id);
    } finally {
      kemajuan.remove(id);
    }
  }
}
