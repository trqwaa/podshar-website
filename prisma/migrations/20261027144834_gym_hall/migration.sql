-- CreateTable
CREATE TABLE "gym_sets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "block" INTEGER NOT NULL,
    "index" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "warmup" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "gym_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_profiles" (
    "userId" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT 'hypertrophy',
    "heightCm" DOUBLE PRECISION,
    "sex" TEXT NOT NULL DEFAULT 'male',
    "activity" TEXT NOT NULL DEFAULT 'mid',
    "bornYear" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gym_profiles_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "gym_goals" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subject" TEXT,
    "target" DOUBLE PRECISION NOT NULL,
    "deadline" TEXT,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_plan_days" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "gym_plan_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_plan_items" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "exercise" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "gym_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_measures" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "part" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "takenOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_measures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_food" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eatenOn" TEXT NOT NULL,
    "meal" TEXT NOT NULL,
    "food" TEXT,
    "name" TEXT NOT NULL,
    "grams" DOUBLE PRECISION,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "junk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_sleep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "night" TEXT NOT NULL,
    "bedAt" TIMESTAMP(3) NOT NULL,
    "wakeAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "deep" INTEGER,
    "rem" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_sleep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gym_verdicts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gym_verdicts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gym_sets_sessionId_block_index_idx" ON "gym_sets"("sessionId", "block", "index");

-- CreateIndex
CREATE INDEX "gym_sets_exercise_idx" ON "gym_sets"("exercise");

-- CreateIndex
CREATE INDEX "gym_goals_userId_idx" ON "gym_goals"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "gym_plan_days_userId_weekday_key" ON "gym_plan_days"("userId", "weekday");

-- CreateIndex
CREATE INDEX "gym_plan_items_dayId_position_idx" ON "gym_plan_items"("dayId", "position");

-- CreateIndex
CREATE INDEX "gym_measures_userId_part_takenOn_idx" ON "gym_measures"("userId", "part", "takenOn");

-- CreateIndex
CREATE INDEX "gym_food_userId_eatenOn_idx" ON "gym_food"("userId", "eatenOn");

-- CreateIndex
CREATE UNIQUE INDEX "gym_sleep_userId_night_key" ON "gym_sleep"("userId", "night");

-- CreateIndex
CREATE INDEX "gym_verdicts_userId_createdAt_idx" ON "gym_verdicts"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "gym_sets" ADD CONSTRAINT "gym_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "gym_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_profiles" ADD CONSTRAINT "gym_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_goals" ADD CONSTRAINT "gym_goals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_plan_days" ADD CONSTRAINT "gym_plan_days_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_plan_items" ADD CONSTRAINT "gym_plan_items_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "gym_plan_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_measures" ADD CONSTRAINT "gym_measures_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_food" ADD CONSTRAINT "gym_food_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_sleep" ADD CONSTRAINT "gym_sleep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gym_verdicts" ADD CONSTRAINT "gym_verdicts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
