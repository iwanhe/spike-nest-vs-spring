package id.kcsi.spike.keamanan;

import jakarta.servlet.DispatcherType;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

// S6: setiap permintaan harus membawa token dari penyedia identitas (Keycloak).
// AUTH_ISSUER kosong berarti pemeriksaan dimatikan; itu hanya untuk uji S1 sampai S5
// di spike ini dan tidak boleh ada di aplikasi sungguhan.
@Configuration
public class KeamananConfig {

  @Bean
  SecurityFilterChain rantaiKeamanan(HttpSecurity http, @Value("${AUTH_ISSUER:}") String penerbit)
      throws Exception {
    http.csrf(csrf -> csrf.disable()); // API tanpa sesi dan tanpa cookie
    http.sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS));

    if (penerbit.isBlank()) {
      http.authorizeHttpRequests(a -> a.anyRequest().permitAll());
      return http.build();
    }

    // Kunci publik diambil dari penyedia identitas; tanda tangan, penerbit, dan masa berlaku diperiksa.
    NimbusJwtDecoder pembaca =
        NimbusJwtDecoder.withJwkSetUri(penerbit + "/protocol/openid-connect/certs").build();
    pembaca.setJwtValidator(JwtValidators.createDefaultWithIssuer(penerbit));

    // Peran Keycloak ada di klaim realm_access.roles.
    JwtAuthenticationConverter pengubah = new JwtAuthenticationConverter();
    pengubah.setPrincipalClaimName("preferred_username");
    pengubah.setJwtGrantedAuthoritiesConverter(jwt -> {
      Map<String, Object> akses = jwt.getClaimAsMap("realm_access");
      Object daftar = akses == null ? null : akses.get("roles");
      Collection<GrantedAuthority> hasil = new ArrayList<>();
      if (daftar instanceof List<?> peran) {
        for (Object p : peran) hasil.add(new SimpleGrantedAuthority("ROLE_" + p));
      }
      return hasil;
    });

    http.authorizeHttpRequests(a -> a
        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
        // Hanya penyetuju yang boleh memutuskan.
        .requestMatchers(HttpMethod.POST, "/pengajuan/*/keputusan").hasRole("penyetuju")
        .anyRequest().authenticated());
    http.oauth2ResourceServer(o -> o.jwt(j -> j.decoder(pembaca).jwtAuthenticationConverter(pengubah)));
    return http.build();
  }
}
