# Image Spring Boot untuk S6. Dibangun dari jar hasil build, jadi jalankan `mvn package` lebih dulu.
FROM eclipse-temurin:21-jre
WORKDIR /app
# Pengguna khusus tanpa hak root.
RUN useradd --system --uid 10001 --no-create-home spike && mkdir -p /app/ekspor-keluar && chown 10001 /app/ekspor-keluar
COPY target/*.jar /app/app.jar
USER 10001
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
