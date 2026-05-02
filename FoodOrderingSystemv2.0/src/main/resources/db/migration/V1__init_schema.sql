DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS restaurant_tables CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS app_users CASCADE;

CREATE TABLE app_users (
                           id BIGSERIAL PRIMARY KEY,
                           username VARCHAR(50) NOT NULL UNIQUE,
                           password_hash VARCHAR(255) NOT NULL,
                           full_name VARCHAR(100),
                           role VARCHAR(20) NOT NULL,
                           is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE categories (
                            id BIGSERIAL PRIMARY KEY,
                            name VARCHAR(100) NOT NULL UNIQUE,
                            description TEXT,
                            is_active BOOLEAN NOT NULL DEFAULT TRUE,
                            display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE restaurant_tables (
                                   id BIGSERIAL PRIMARY KEY,
                                   table_number INTEGER NOT NULL UNIQUE,
                                   location VARCHAR(100),
                                   capacity INTEGER NOT NULL,
                                   status VARCHAR(20) NOT NULL,
                                   table_token VARCHAR(255) UNIQUE
);

CREATE TABLE menu_items (
                            id BIGSERIAL PRIMARY KEY,
                            category_id BIGINT NOT NULL REFERENCES categories(id),
                            name VARCHAR(150) NOT NULL,
                            description TEXT,
                            price NUMERIC(12,2) NOT NULL,
                            avg_prep_time INTEGER NOT NULL,
                            stock_quantity INTEGER NOT NULL DEFAULT 0,
                            is_available BOOLEAN NOT NULL DEFAULT TRUE,
                            image_url VARCHAR(500)
);

CREATE TABLE orders (
                        id BIGSERIAL PRIMARY KEY,
                        order_number VARCHAR(50) NOT NULL UNIQUE,
                        restaurant_table_id BIGINT NOT NULL REFERENCES restaurant_tables(id),
                        order_status VARCHAR(30) NOT NULL,
                        total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
                        placed_at TIMESTAMP WITH TIME ZONE NOT NULL,
                        notes TEXT
);

CREATE TABLE order_items (
                             id BIGSERIAL PRIMARY KEY,
                             order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                             menu_item_id BIGINT NOT NULL REFERENCES menu_items(id),
                             quantity INTEGER NOT NULL,
                             unit_price NUMERIC(12,2) NOT NULL,
                             line_total NUMERIC(12,2) NOT NULL,
                             item_status VARCHAR(30) NOT NULL,
                             special_instructions TEXT
);

CREATE TABLE transactions (
                              id BIGSERIAL PRIMARY KEY,
                              order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
                              transaction_ref VARCHAR(100) NOT NULL UNIQUE,
                              amount NUMERIC(12,2) NOT NULL,
                              payment_method VARCHAR(30) NOT NULL,
                              payment_status VARCHAR(30) NOT NULL,
                              paid_at TIMESTAMP WITH TIME ZONE
);