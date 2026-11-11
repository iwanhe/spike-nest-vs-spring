# Image Spring Boot untuk S6. Dibangun dari jar hasil build, jadi jalankan `mvn package` lebih dulu.
# Base image dikunci ke digest supaya build bisa diulang persis; Dependabot membuka PR bila ada digest baru.
FROM eclipse-temurin:21-jre@sha256:0b99b3376fbb50dbf9c0af8535fdd5b8eb0d3fdfc8b1e4967f383b6919f6901a
WORKDIR /app
# Pengguna khusus tanpa hak root.
RUN useradd --system --uid 10001 --no-create-home spike && mkdir -p /app/ekspor-keluar && chown 10001 /app/ekspor-keluar
COPY target/*.jar /app/app.jar
USER 10001
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
