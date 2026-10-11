package id.kcsi.spike.umum;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

// S6: ID korelasi mengikuti satu permintaan dari awal sampai akhir,
// supaya semua baris log milik permintaan itu bisa dikumpulkan.
// MDC membuat ID ini otomatis ikut di setiap baris log selama permintaan diproses.
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class IdKorelasiFilter extends OncePerRequestFilter {
  public static final String KUNCI = "idKorelasi";
  private static final Logger log = LoggerFactory.getLogger(IdKorelasiFilter.class);

  @Override
  protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain rantai)
      throws ServletException, IOException {
    String kiriman = req.getHeader("x-id-korelasi");
    String id = kiriman != null && !kiriman.isBlank() && kiriman.length() <= 100
        ? kiriman : UUID.randomUUID().toString();
    res.setHeader("x-id-korelasi", id);
    MDC.put(KUNCI, id);
    try {
      if (!req.getRequestURI().startsWith("/actuator")) {
        log.info("permintaan masuk {} {}", req.getMethod(), req.getRequestURI());
      }
      rantai.doFilter(req, res);
    } finally {
      MDC.remove(KUNCI);
    }
  }
}
