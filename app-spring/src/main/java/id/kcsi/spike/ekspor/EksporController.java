package id.kcsi.spike.ekspor;

import java.util.Map;
import java.util.UUID;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/ekspor")
public class EksporController {
  public record Permintaan(Integer jumlahBaris) {}

  private final EksporService service;

  public EksporController(EksporService service) {
    this.service = service;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.ACCEPTED)
  public Map<String, String> mulai(@RequestBody(required = false) Permintaan permintaan) {
    int jumlah = permintaan == null || permintaan.jumlahBaris() == null ? 100000 : permintaan.jumlahBaris();
    if (jumlah < 1 || jumlah > 1000000) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "jumlahBaris harus bilangan bulat antara 1 dan 1.000.000");
    }
    return Map.of("idPekerjaan", service.mulai(jumlah).toString());
  }

  @GetMapping("/{id}")
  public Map<String, Object> status(@PathVariable UUID id) {
    return service.status(id);
  }

  @GetMapping("/{id}/csv")
  public ResponseEntity<Resource> csv(@PathVariable UUID id) {
    service.pastikanSelesai(id);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
        .body(new FileSystemResource(service.berkas(id, "csv")));
  }

  @GetMapping("/{id}/xlsx")
  public ResponseEntity<Resource> xlsx(@PathVariable UUID id) {
    service.pastikanSelesai(id);
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .body(new FileSystemResource(service.berkas(id, "xlsx")));
  }
}
