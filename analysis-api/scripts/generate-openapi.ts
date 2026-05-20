import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { writeFileSync } from "fs";
import * as yaml from "js-yaml";
import { join } from "path";
import { AppModule } from "../src/app.module";
import { buildSwaggerConfig } from "../src/swagger.config";

async function generate() {
  // abortOnError: false — не прерывать при ошибках onModuleInit
  // (например, если PostgreSQL недоступен во время генерации)
  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });

  app.setGlobalPrefix("api");

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  const outputPath = join(process.cwd(), "openapi.yaml");
  writeFileSync(outputPath, yaml.dump(document, { indent: 2, lineWidth: 120, noRefs: true }), "utf8");

  console.log(`OpenAPI spec saved → ${outputPath}`);

  await app.close();
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
