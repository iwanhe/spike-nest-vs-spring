# Image Spring Boot untuk S6. Dibangun dari jar hasil build, jadi jalankan `mvn package` lebih dulu.
# Base image dikunci ke digest supaya build bisa diulang persis; Dependabot membuka PR bila ada digest baru.
FROM eclipse-temurin:25-jre@sha256:ecdc0adb37bde1a281c4d245a3cd535004b1fc8322d560f5b09463b248c81df0
WORKDIR /app
# Pengguna khusus tanpa hak root.
RUN useradd --system --uid 10001 --no-create-home spike && mkdir -p /app/ekspor-keluar && chown 10001 /app/ekspor-keluar
COPY target/*.jar /app/app.jar
USER 10001
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
