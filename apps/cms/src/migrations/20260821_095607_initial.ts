import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('superadmin', 'admin', 'operator');
  CREATE TYPE "public"."enum_tenants_plan" AS ENUM('starter', 'pro', 'enterprise');
  CREATE TYPE "public"."enum_telegram_accounts_status" AS ENUM('pending', 'warmup', 'active', 'limited', 'banned');
  CREATE TYPE "public"."enum_agents_status" AS ENUM('active', 'paused');
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'in_progress', 'converted', 'closed');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum_users_role" DEFAULT 'admin' NOT NULL,
  	"tenant_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "tenants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"plan" "enum_tenants_plan" DEFAULT 'starter',
  	"limits" jsonb DEFAULT '{"maxAgents":5,"maxAccounts":3}'::jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "telegram_accounts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"phone" varchar NOT NULL,
  	"status" "enum_telegram_accounts_status" DEFAULT 'pending',
  	"daily_limit" numeric DEFAULT 5,
  	"sent_today" numeric DEFAULT 0,
  	"warmup_stage" numeric DEFAULT 0,
  	"runtime_id" varchar,
  	"has_session" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "scripts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"version" varchar DEFAULT '1' NOT NULL,
  	"system_prompt" varchar DEFAULT 'Ты менеджер по продажам в Telegram. Пиши коротко, по-человечески, без канцелярита.' NOT NULL,
  	"steps" jsonb DEFAULT '{"initial":"start","nodes":{"start":{"goal":"Поздороваться и кратко представить оффер","instructions":"Короткое дружелюбное первое сообщение, без спама.","allowed_next":["qualify","objection"]},"qualify":{"goal":"Выяснить потребность лида","instructions":"Задай 1-2 уточняющих вопроса.","allowed_next":["offer","objection","handoff"]},"offer":{"goal":"Сделать предложение и CTA","allowed_next":["close","objection"]},"objection":{"goal":"Отработать возражение","allowed_next":["offer","handoff","close"]},"close":{"goal":"Закрыть на действие (созвон/оплата/ссылка)","allowed_next":[]},"handoff":{"goal":"Передать человеку","instructions":"Если вопрос сложный — needs_human=true","allowed_next":[]}}}'::jsonb NOT NULL,
  	"fallback_rules" jsonb DEFAULT '{"onError":"handoff"}'::jsonb,
  	"runtime_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "agents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"name" varchar NOT NULL,
  	"telegram_account_id" integer NOT NULL,
  	"script_id" integer NOT NULL,
  	"llm_model" varchar DEFAULT 'gpt-4o-mini',
  	"temperature" numeric DEFAULT 0.7,
  	"status" "enum_agents_status" DEFAULT 'active',
  	"runtime_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"telegram_username" varchar,
  	"telegram_id" numeric,
  	"source" varchar,
  	"status" "enum_leads_status" DEFAULT 'new',
  	"custom_fields" jsonb DEFAULT '{}'::jsonb,
  	"runtime_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"tenants_id" integer,
  	"telegram_accounts_id" integer,
  	"scripts_id" integer,
  	"agents_id" integer,
  	"leads_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "telegram_accounts" ADD CONSTRAINT "telegram_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "scripts" ADD CONSTRAINT "scripts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agents" ADD CONSTRAINT "agents_telegram_account_id_telegram_accounts_id_fk" FOREIGN KEY ("telegram_account_id") REFERENCES "public"."telegram_accounts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agents" ADD CONSTRAINT "agents_script_id_scripts_id_fk" FOREIGN KEY ("script_id") REFERENCES "public"."scripts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_telegram_accounts_fk" FOREIGN KEY ("telegram_accounts_id") REFERENCES "public"."telegram_accounts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_scripts_fk" FOREIGN KEY ("scripts_id") REFERENCES "public"."scripts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agents_fk" FOREIGN KEY ("agents_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "tenants_updated_at_idx" ON "tenants" USING btree ("updated_at");
  CREATE INDEX "tenants_created_at_idx" ON "tenants" USING btree ("created_at");
  CREATE INDEX "telegram_accounts_tenant_idx" ON "telegram_accounts" USING btree ("tenant_id");
  CREATE INDEX "telegram_accounts_updated_at_idx" ON "telegram_accounts" USING btree ("updated_at");
  CREATE INDEX "telegram_accounts_created_at_idx" ON "telegram_accounts" USING btree ("created_at");
  CREATE INDEX "scripts_tenant_idx" ON "scripts" USING btree ("tenant_id");
  CREATE INDEX "scripts_updated_at_idx" ON "scripts" USING btree ("updated_at");
  CREATE INDEX "scripts_created_at_idx" ON "scripts" USING btree ("created_at");
  CREATE INDEX "agents_tenant_idx" ON "agents" USING btree ("tenant_id");
  CREATE INDEX "agents_telegram_account_idx" ON "agents" USING btree ("telegram_account_id");
  CREATE INDEX "agents_script_idx" ON "agents" USING btree ("script_id");
  CREATE INDEX "agents_updated_at_idx" ON "agents" USING btree ("updated_at");
  CREATE INDEX "agents_created_at_idx" ON "agents" USING btree ("created_at");
  CREATE INDEX "leads_tenant_idx" ON "leads" USING btree ("tenant_id");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_tenants_id_idx" ON "payload_locked_documents_rels" USING btree ("tenants_id");
  CREATE INDEX "payload_locked_documents_rels_telegram_accounts_id_idx" ON "payload_locked_documents_rels" USING btree ("telegram_accounts_id");
  CREATE INDEX "payload_locked_documents_rels_scripts_id_idx" ON "payload_locked_documents_rels" USING btree ("scripts_id");
  CREATE INDEX "payload_locked_documents_rels_agents_id_idx" ON "payload_locked_documents_rels" USING btree ("agents_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "tenants" CASCADE;
  DROP TABLE "telegram_accounts" CASCADE;
  DROP TABLE "scripts" CASCADE;
  DROP TABLE "agents" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_tenants_plan";
  DROP TYPE "public"."enum_telegram_accounts_status";
  DROP TYPE "public"."enum_agents_status";
  DROP TYPE "public"."enum_leads_status";`)
}
