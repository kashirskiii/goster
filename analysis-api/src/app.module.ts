import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { ChecksModule } from "./checks/checks.module";
import { DialogsModule } from "./dialogs/dialogs.module";
import { FilesModule } from "./files/files.module";
import { MessagesModule } from "./messages/messages.module";
import { PresetsModule } from "./presets/presets.module";
import { PrismaModule } from "./prisma/prisma.module";
import { SubmissionsModule } from "./submissions/submissions.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ChecksModule,
    SubmissionsModule,
    DialogsModule,
    FilesModule,
    MessagesModule,
    PresetsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
