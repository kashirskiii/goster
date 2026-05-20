import { PrismaClient, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const SALT_ROUNDS = 10;

  const [teacherHash, studentHash] = await Promise.all([
    bcrypt.hash("0000", SALT_ROUNDS),
    bcrypt.hash("0000", SALT_ROUNDS),
  ]);

  const teacher = await prisma.user.upsert({
    where: { email: "teacher@example.com" },
    update: {},
    create: {
      email: "teacher@example.com",
      lastName: "Вагарина",
      firstName: "Наталия",
      middleName: "Сергеевна",
      role: UserRole.teacher,
      passwordHash: teacherHash,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: "student@example.com" },
    update: {},
    create: {
      email: "student@example.com",
      lastName: "Каширский",
      firstName: "Егор",
      middleName: "Сергеевич",
      role: UserRole.student,
      passwordHash: studentHash,
    },
  });

  const gost7322017Config = {
    allowed_fonts: [
      {
        name: "TimesNewRomanPSMT",
        size: 14,
        color: [0, 0, 0],
        size_tolerance: 0.5,
        color_tolerance: 35,
        description: "Times New Roman, 14pt, чёрный",
      },
      {
        name: "TimesNewRomanPS-BoldMT",
        size: 14,
        color: [0, 0, 0],
        size_tolerance: 0.5,
        color_tolerance: 35,
        description: "Times New Roman Bold, 14pt, чёрный",
      },
      {
        name: "ArialMT",
        size: 12,
        color: [0, 0, 0],
        description: "Arial, 12pt, чёрный",
      },
    ],
    ignore_fonts: ["SymbolMT"],
    validators: {
      page_number: true,
      figure_caption: true,
      toc: true,
      structural_heading: true,
      margin: true,
      list: true,
    },
    margins: {
      left_mm: 30,
      right_mm: 15,
      top_mm: 20,
      bottom_mm: 20,
      tolerance_mm: 2.5,
      ignore_top_band_mm: 15,
      ignore_bottom_band_mm: 15,
    },
  };

  const presets = [
    {
      code: "gost-7.32-2017",
      name: "ГОСТ 7.32-2017",
      description:
        "Стандартные требования к НИР: Times New Roman 14pt чёрный (+ Bold), Arial 12pt для подписей.",
      config: gost7322017Config,
    },
    {
      code: "gost-no-font-check",
      name: "Без проверки шрифта",
      description:
        "Все остальные ГОСТ-валидаторы (нумерация, оглавление, заголовки, подписи), но без ограничений по шрифту.",
      config: { ...gost7322017Config, allowed_fonts: [] },
    },
  ];

  for (const p of presets) {
    await prisma.gostPreset.upsert({
      where: { code: p.code },
      update: { name: p.name, description: p.description, config: p.config },
      create: p,
    });
  }

  console.log("Seed complete:");
  console.log(`  teacher → ${teacher.email} (id: ${teacher.id})`);
  console.log(`  student → ${student.email} (id: ${student.id})`);
  console.log(`  presets → ${presets.map((p) => p.code).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
