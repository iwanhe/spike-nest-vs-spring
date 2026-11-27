# Image Spring Boot untuk S6. Dibangun dari jar hasil build, jadi jalankan `mvn package` lebih dulu.
# Base image dikunci ke digest supaya build bisa diulang persis; Dependabot membuka PR bila ada digest baru.
FROM eclipse-temurin:21-jre@sha256:18bb4a91a3dea3f03ee31d3755af34dfb40f904fc77ab56cdc2f092e32fff9c2
WORKDIR /app
# Pengguna khusus tanpa hak root.
RUN useradd --system --uid 10001 --no-create-home spike && mkdir -p /app/ekspor-keluar && chown 10001 /app/ekspor-keluar
COPY target/*.jar /app/app.jar
USER 10001
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
