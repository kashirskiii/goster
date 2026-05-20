import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { buildSwaggerConfig } from "./swagger.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix("api");

  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Application:  http://localhost:${port}/api`);
  console.log(`Swagger UI:   http://localhost:${port}/api/docs`);
}

bootstrap();
