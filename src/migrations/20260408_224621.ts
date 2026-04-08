import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_stores_platform" AS ENUM('magento2', 'shopify');
  CREATE TYPE "public"."enum_campaign_types_day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "public"."enum_campaign_log_status" AS ENUM('success', 'failed', 'pending');
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "stores" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"platform" "enum_stores_platform" NOT NULL,
  	"store_url" varchar NOT NULL,
  	"logo_image_id" integer,
  	"api_credentials_api_url" varchar,
  	"api_credentials_api_key" varchar,
  	"api_credentials_api_secret" varchar,
  	"klaviyo_api_key" varchar NOT NULL,
  	"klaviyo_list_id" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaign_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"day_of_week" "enum_campaign_types_day_of_week" NOT NULL,
  	"title_template" varchar NOT NULL,
  	"body_copy" jsonb,
  	"product_selection_rule" jsonb NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "banners_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "banners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"image_id" integer NOT NULL,
  	"campaign_type_id" integer NOT NULL,
  	"store_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "category_pools" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"category_name" varchar NOT NULL,
  	"category_url" varchar NOT NULL,
  	"campaign_type_id" integer NOT NULL,
  	"store_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "selection_history" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"week" varchar NOT NULL,
  	"campaign_type_id" integer NOT NULL,
  	"store_id" integer NOT NULL,
  	"selected_banners" jsonb,
  	"selected_products" jsonb,
  	"selected_categories" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "campaign_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"store_id" integer NOT NULL,
  	"campaign_type_id" integer NOT NULL,
  	"status" "enum_campaign_log_status" DEFAULT 'pending' NOT NULL,
  	"klaviyo_campaign_id" varchar,
  	"error" varchar,
  	"selected_content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stores_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_types_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "banners_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "category_pools_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "selection_history_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "campaign_log_id" integer;
  ALTER TABLE "stores" ADD CONSTRAINT "stores_logo_image_id_media_id_fk" FOREIGN KEY ("logo_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners_tags" ADD CONSTRAINT "banners_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_campaign_type_id_campaign_types_id_fk" FOREIGN KEY ("campaign_type_id") REFERENCES "public"."campaign_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "banners" ADD CONSTRAINT "banners_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "category_pools" ADD CONSTRAINT "category_pools_campaign_type_id_campaign_types_id_fk" FOREIGN KEY ("campaign_type_id") REFERENCES "public"."campaign_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "category_pools" ADD CONSTRAINT "category_pools_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_history" ADD CONSTRAINT "selection_history_campaign_type_id_campaign_types_id_fk" FOREIGN KEY ("campaign_type_id") REFERENCES "public"."campaign_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "selection_history" ADD CONSTRAINT "selection_history_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_log" ADD CONSTRAINT "campaign_log_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "campaign_log" ADD CONSTRAINT "campaign_log_campaign_type_id_campaign_types_id_fk" FOREIGN KEY ("campaign_type_id") REFERENCES "public"."campaign_types"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "stores_logo_image_idx" ON "stores" USING btree ("logo_image_id");
  CREATE INDEX "stores_updated_at_idx" ON "stores" USING btree ("updated_at");
  CREATE INDEX "stores_created_at_idx" ON "stores" USING btree ("created_at");
  CREATE INDEX "campaign_types_updated_at_idx" ON "campaign_types" USING btree ("updated_at");
  CREATE INDEX "campaign_types_created_at_idx" ON "campaign_types" USING btree ("created_at");
  CREATE INDEX "banners_tags_order_idx" ON "banners_tags" USING btree ("_order");
  CREATE INDEX "banners_tags_parent_id_idx" ON "banners_tags" USING btree ("_parent_id");
  CREATE INDEX "banners_image_idx" ON "banners" USING btree ("image_id");
  CREATE INDEX "banners_campaign_type_idx" ON "banners" USING btree ("campaign_type_id");
  CREATE INDEX "banners_store_idx" ON "banners" USING btree ("store_id");
  CREATE INDEX "banners_updated_at_idx" ON "banners" USING btree ("updated_at");
  CREATE INDEX "banners_created_at_idx" ON "banners" USING btree ("created_at");
  CREATE INDEX "category_pools_campaign_type_idx" ON "category_pools" USING btree ("campaign_type_id");
  CREATE INDEX "category_pools_store_idx" ON "category_pools" USING btree ("store_id");
  CREATE INDEX "category_pools_updated_at_idx" ON "category_pools" USING btree ("updated_at");
  CREATE INDEX "category_pools_created_at_idx" ON "category_pools" USING btree ("created_at");
  CREATE INDEX "selection_history_campaign_type_idx" ON "selection_history" USING btree ("campaign_type_id");
  CREATE INDEX "selection_history_store_idx" ON "selection_history" USING btree ("store_id");
  CREATE INDEX "selection_history_updated_at_idx" ON "selection_history" USING btree ("updated_at");
  CREATE INDEX "selection_history_created_at_idx" ON "selection_history" USING btree ("created_at");
  CREATE INDEX "campaign_log_store_idx" ON "campaign_log" USING btree ("store_id");
  CREATE INDEX "campaign_log_campaign_type_idx" ON "campaign_log" USING btree ("campaign_type_id");
  CREATE INDEX "campaign_log_updated_at_idx" ON "campaign_log" USING btree ("updated_at");
  CREATE INDEX "campaign_log_created_at_idx" ON "campaign_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stores_fk" FOREIGN KEY ("stores_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_types_fk" FOREIGN KEY ("campaign_types_id") REFERENCES "public"."campaign_types"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_banners_fk" FOREIGN KEY ("banners_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_category_pools_fk" FOREIGN KEY ("category_pools_id") REFERENCES "public"."category_pools"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_selection_history_fk" FOREIGN KEY ("selection_history_id") REFERENCES "public"."selection_history"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_campaign_log_fk" FOREIGN KEY ("campaign_log_id") REFERENCES "public"."campaign_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_stores_id_idx" ON "payload_locked_documents_rels" USING btree ("stores_id");
  CREATE INDEX "payload_locked_documents_rels_campaign_types_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_types_id");
  CREATE INDEX "payload_locked_documents_rels_banners_id_idx" ON "payload_locked_documents_rels" USING btree ("banners_id");
  CREATE INDEX "payload_locked_documents_rels_category_pools_id_idx" ON "payload_locked_documents_rels" USING btree ("category_pools_id");
  CREATE INDEX "payload_locked_documents_rels_selection_history_id_idx" ON "payload_locked_documents_rels" USING btree ("selection_history_id");
  CREATE INDEX "payload_locked_documents_rels_campaign_log_id_idx" ON "payload_locked_documents_rels" USING btree ("campaign_log_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stores" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaign_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "banners_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "banners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "category_pools" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "selection_history" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "campaign_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media" CASCADE;
  DROP TABLE "stores" CASCADE;
  DROP TABLE "campaign_types" CASCADE;
  DROP TABLE "banners_tags" CASCADE;
  DROP TABLE "banners" CASCADE;
  DROP TABLE "category_pools" CASCADE;
  DROP TABLE "selection_history" CASCADE;
  DROP TABLE "campaign_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stores_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaign_types_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_banners_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_category_pools_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_selection_history_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_campaign_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  DROP INDEX "payload_locked_documents_rels_stores_id_idx";
  DROP INDEX "payload_locked_documents_rels_campaign_types_id_idx";
  DROP INDEX "payload_locked_documents_rels_banners_id_idx";
  DROP INDEX "payload_locked_documents_rels_category_pools_id_idx";
  DROP INDEX "payload_locked_documents_rels_selection_history_id_idx";
  DROP INDEX "payload_locked_documents_rels_campaign_log_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stores_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaign_types_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "banners_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "category_pools_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "selection_history_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "campaign_log_id";
  DROP TYPE "public"."enum_stores_platform";
  DROP TYPE "public"."enum_campaign_types_day_of_week";
  DROP TYPE "public"."enum_campaign_log_status";`)
}
