-- ENTREPRENEUR FUNDING PLATFORM - DATABASE SETUP

CREATE DATABASE IF NOT EXISTS entrepreneur_funding;
USE entrepreneur_funding;

-- 1. ROLE TABLE
CREATE TABLE IF NOT EXISTS ROLE (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. USER TABLE
CREATE TABLE IF NOT EXISTS USERS (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES ROLE(role_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 3. VERIFICATION TABLE
CREATE TABLE IF NOT EXISTS VERIFICATION (
    verification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    id_type VARCHAR(50) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- 4. CATEGORY TABLE
CREATE TABLE IF NOT EXISTS CATEGORY (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- 5. PROJECT TABLE
CREATE TABLE IF NOT EXISTS PROJECT (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    funding_goal DECIMAL(12,2) NOT NULL CHECK (funding_goal > 0),
    deadline DATE NOT NULL,
    status ENUM('Active','Funded','Closed') DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    entrepreneur_id INT NOT NULL,
    category_id INT NOT NULL,
    FOREIGN KEY (entrepreneur_id) REFERENCES USERS(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    FOREIGN KEY (category_id) REFERENCES CATEGORY(category_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 6. INVESTMENT TABLE
CREATE TABLE IF NOT EXISTS INVESTMENT (
    investment_id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    invested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    project_id INT NOT NULL,
    investor_id INT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES PROJECT(project_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (investor_id) REFERENCES USERS(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 7. FUNDING TRACKER TABLE
CREATE TABLE IF NOT EXISTS FUNDING_TRACKER (
    tracker_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL UNIQUE,
    total_collected DECIMAL(12,2) DEFAULT 0,
    remaining_amount DECIMAL(12,2) DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES PROJECT(project_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ============================================
-- SEED DATA
-- ============================================

-- Insert default roles
INSERT IGNORE INTO ROLE (role_name) VALUES ('Ordinary User'), ('Entrepreneur'), ('Investor');

-- Insert default categories
INSERT IGNORE INTO CATEGORY (category_name) VALUES
('Technology'), ('Healthcare'), ('Education'), ('Agriculture'),
('Finance'), ('Energy'), ('Real Estate'), ('E-Commerce'),
('Food & Beverage'), ('Entertainment');

-- ============================================
-- TRIGGERS: Auto-manage FUNDING_TRACKER
-- ============================================

DELIMITER //

-- When a new investment is made, update funding tracker
CREATE TRIGGER IF NOT EXISTS after_investment_insert
AFTER INSERT ON INVESTMENT
FOR EACH ROW
BEGIN
    DECLARE goal DECIMAL(12,2);
    SELECT funding_goal INTO goal FROM PROJECT WHERE project_id = NEW.project_id;

    INSERT INTO FUNDING_TRACKER (project_id, total_collected, remaining_amount)
    VALUES (NEW.project_id, NEW.amount, goal - NEW.amount)
    ON DUPLICATE KEY UPDATE
        total_collected = total_collected + NEW.amount,
        remaining_amount = goal - (total_collected + NEW.amount);

    -- Auto-update project status if fully funded
    UPDATE PROJECT SET status = 'Funded'
    WHERE project_id = NEW.project_id
    AND (SELECT total_collected FROM FUNDING_TRACKER WHERE project_id = NEW.project_id) >= funding_goal;
END//

DELIMITER ;
