-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."managers" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "active" BOOLEAN DEFAULT true,
    "email_verified" BOOLEAN DEFAULT false,
    "full_name" VARCHAR(100),
    "phone_number" VARCHAR(20),
    "address" TEXT,
    "profile_image" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "regional_manager_id" INTEGER,

    CONSTRAINT "managers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."restaurants" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(255),
    "name" VARCHAR(255) NOT NULL,
    "location" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "zip_code" VARCHAR(20),
    "country" VARCHAR(100),
    "contact_number" VARCHAR(50),
    "created_by" INTEGER,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN DEFAULT true,
    "unit_id" VARCHAR(50),

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_analytics_results" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(50) NOT NULL,
    "time_period" VARCHAR(50) NOT NULL,
    "analytics_data" JSONB NOT NULL,
    "calculation_date" DATE NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "email" VARCHAR(255),

    CONSTRAINT "store_analytics_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_credentials" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(255) NOT NULL,
    "client_id" VARCHAR(255) NOT NULL,
    "client_secret" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "email" VARCHAR(255),
    "cid" VARCHAR(255),

    CONSTRAINT "store_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_embeddings" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(50) NOT NULL,
    "data_type" VARCHAR(50) NOT NULL,
    "record_id" VARCHAR(255),
    "data_hash" VARCHAR(255) NOT NULL,
    "chunk_index" INTEGER DEFAULT 0,
    "text_content" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "original_data" JSONB,
    "record_date" DATE,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_employees" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(50) NOT NULL,
    "employee_id" VARCHAR(100),
    "name" VARCHAR(255),
    "role" VARCHAR(100),
    "hire_date" DATE,
    "termination_date" DATE,
    "hourly_rate" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_inventory" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(50) NOT NULL,
    "inventory_date" DATE,
    "ingredient" VARCHAR(255),
    "quantity" DECIMAL,
    "par_level" DECIMAL,
    "unit_cost" DECIMAL,
    "is_low" BOOLEAN,
    "waste" DECIMAL DEFAULT 0,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_menu" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(50) NOT NULL,
    "menu_item" VARCHAR(255),
    "ingredient" VARCHAR(255),
    "amount" DECIMAL,
    "unit_cost" DECIMAL,
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."store_sales" (
    "id" SERIAL NOT NULL,
    "store_id" VARCHAR(50) NOT NULL,
    "sale_id" VARCHAR(100),
    "sale_date" DATE,
    "sale_time" TIMESTAMP(6),
    "sold_items_name" TEXT,
    "number_of_items" DECIMAL,
    "subtotal" DECIMAL,
    "tip" DECIMAL,
    "total_amount" DECIMAL,
    "payment_method" VARCHAR(255),
    "order_type" VARCHAR(100),
    "customer_id" VARCHAR(100),
    "is_loyalty" BOOLEAN,
    "promotion_id" VARCHAR(100),
    "discount_applied" DECIMAL,
    "table_number" VARCHAR(50),
    "guest_count" INTEGER,
    "seated_time" TIMESTAMP(6),
    "departure_time" TIMESTAMP(6),
    "was_reservation" BOOLEAN,
    "order_received_time" TIMESTAMP(6),
    "kitchen_start_time" TIMESTAMP(6),
    "had_modification" BOOLEAN,
    "order_accuracy" DECIMAL,
    "void_status" BOOLEAN DEFAULT false,
    "reason" TEXT,
    "daypart" VARCHAR(50),
    "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."text_notes" (
    "id" VARCHAR(36) NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "text_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "managers_email_key" ON "public"."managers"("email" ASC);

-- CreateIndex
CREATE INDEX "idx_restaurants_created_by" ON "public"."restaurants"("created_by" ASC);

-- CreateIndex
CREATE INDEX "idx_restaurants_name" ON "public"."restaurants"("name" ASC);

-- CreateIndex
CREATE INDEX "idx_restaurants_store_id" ON "public"."restaurants"("store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_unit_id_key" ON "public"."restaurants"("unit_id" ASC);

-- CreateIndex
CREATE INDEX "idx_analytics_date" ON "public"."store_analytics_results"("calculation_date" ASC);

-- CreateIndex
CREATE INDEX "idx_analytics_period" ON "public"."store_analytics_results"("time_period" ASC);

-- CreateIndex
CREATE INDEX "idx_analytics_store_id" ON "public"."store_analytics_results"("store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "store_analytics_results_store_id_time_period_calculation_da_key" ON "public"."store_analytics_results"("store_id" ASC, "time_period" ASC, "calculation_date" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "store_credentials_store_id_email_key" ON "public"."store_credentials"("store_id" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "idx_embeddings_data_type" ON "public"."store_embeddings"("data_type" ASC);

-- CreateIndex
CREATE INDEX "idx_embeddings_date" ON "public"."store_embeddings"("record_date" ASC);

-- CreateIndex
CREATE INDEX "idx_embeddings_hash" ON "public"."store_embeddings"("data_hash" ASC);

-- CreateIndex
CREATE INDEX "idx_embeddings_record_id" ON "public"."store_embeddings"("record_id" ASC);

-- CreateIndex
CREATE INDEX "idx_embeddings_store_id" ON "public"."store_embeddings"("store_id" ASC);

-- CreateIndex
CREATE INDEX "idx_employees_store_id" ON "public"."store_employees"("store_id" ASC);

-- CreateIndex
CREATE INDEX "idx_inventory_date" ON "public"."store_inventory"("inventory_date" ASC);

-- CreateIndex
CREATE INDEX "idx_inventory_store_id" ON "public"."store_inventory"("store_id" ASC);

-- CreateIndex
CREATE INDEX "idx_menu_store_id" ON "public"."store_menu"("store_id" ASC);

-- CreateIndex
CREATE INDEX "idx_sales_date" ON "public"."store_sales"("sale_date" ASC);

-- CreateIndex
CREATE INDEX "idx_sales_store_id" ON "public"."store_sales"("store_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_store_sales_store_sale" ON "public"."store_sales"("store_id" ASC, "sale_id" ASC);

-- CreateIndex
CREATE INDEX "text_notes_user_email_idx" ON "public"."text_notes"("user_email" ASC);
