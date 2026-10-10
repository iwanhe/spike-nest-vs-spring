package id.kcsi.spike.outbox;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// S5: pekerja latar yang mengirim baris outbox ke ERP.
// Aturannya sama dengan versi NestJS:
// 1. Baris diklaim dan jadwal kirim ulangnya dipasang dalam SATU perintah SQL,
//    sebelum ERP dipanggil. Bila aplikasi mati di tengah pengiriman, baris itu
//    otomatis dicoba lagi setelah jedanya lewat.
// 2. Idempotency-Key selalu id baris outbox, jadi kiriman ulang tidak tercatat ganda.
// 3. Panggilan HTTP punya batas waktu, supaya ERP yang diam tidak menggantung pekerja.
@Component
public class OutboxPekerja {
  private static final Logger log = LoggerFactory.getLogger(OutboxPekerja.class);

  private static final String KLAIM = """
      WITH klaim AS (
        UPDATE outbox o
           SET percobaan = o.percobaan + 1,
               kirim_setelah = now() + make_interval(secs => least(? * power(2, o.percobaan), 60000) / 1000.0)
         WHERE o.id IN (SELECT id FROM outbox
                         WHERE status = 'MENUNGGU' AND kirim_setelah <= now()
                         ORDER BY kirim_setelah
                         LIMIT ?
                           FOR UPDATE SKIP LOCKED)
        RETURNING o.id, o.payload, o.percobaan)
      SELECT id::text AS id, payload::text AS payload, percobaan FROM klaim""";

  private final JdbcTemplate jdbc;
  private final String erpUrl;
  private final long mundurMs;
  private final long batasMs;
  private final int maksPercobaan;
  private final HttpClient http = HttpClient.newBuilder()
      .version(HttpClient.Version.HTTP_1_1)
      .connectTimeout(Duration.ofSeconds(2))
      .build();

  public OutboxPekerja(
      JdbcTemplate jdbc,
      @Value("${ERP_URL:}") String erpUrl,
      @Value("${OUTBOX_MUNDUR_MS:1000}") long mundurMs,
      @Value("${ERP_BATAS_MS:2000}") long batasMs,
      @Value("${OUTBOX_MAKS_PERCOBAAN:20}") int maksPercobaan) {
    this.jdbc = jdbc;
    this.erpUrl = erpUrl;
    this.mundurMs = mundurMs;
    this.batasMs = batasMs;
    this.maksPercobaan = maksPercobaan;
    if (erpUrl.isBlank()) log.warn("ERP_URL kosong: pekerja outbox tidak dijalankan");
  }

  @Scheduled(fixedDelayString = "${OUTBOX_JEDA_MS:1000}")
  public void putaran() {
    if (erpUrl.isBlank()) return;
    List<Map<String, Object>> baris = jdbc.queryForList(KLAIM, mundurMs, 10);
    for (Map<String, Object> b : baris) {
      String id = (String) b.get("id");
      int percobaan = ((Number) b.get("percobaan")).intValue();
      if (kirim(id, (String) b.get("payload"))) {
        jdbc.update("UPDATE outbox SET status = 'TERKIRIM', terkirim_pada = now() WHERE id = ?::uuid", id);
      } else if (percobaan >= maksPercobaan) {
        jdbc.update("UPDATE outbox SET status = 'GAGAL' WHERE id = ?::uuid", id);
      }
    }
  }

  private boolean kirim(String id, String payload) {
    HttpRequest permintaan = HttpRequest.newBuilder(URI.create(erpUrl + "/erp/pengajuan"))
        .timeout(Duration.ofMillis(batasMs))
        .header("content-type", "application/json")
        .header("idempotency-key", id)
        .POST(HttpRequest.BodyPublishers.ofString(payload))
        .build();
    try {
      HttpResponse<String> jawaban = http.send(permintaan, HttpResponse.BodyHandlers.ofString());
      return jawaban.statusCode() / 100 == 2;
    } catch (IOException e) {
      return false; // batas waktu atau koneksi putus: dicoba lagi nanti
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }
}
