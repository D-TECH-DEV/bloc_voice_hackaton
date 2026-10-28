import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('BLOK Relance — API interne')
      .setDescription(
        'Moteur de relance commerciale (mode manual_only par défaut). ' +
          'Aucun appel sortant activé.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(config.PORT, '127.0.0.1');
  // eslint-disable-next-line no-console
  console.log(`relance-backend en écoute sur 127.0.0.1:${config.PORT} (mode manual_only)`);
}

void bootstrap();
