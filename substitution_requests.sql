-- ============================================================
--  substitution_requests table
--  Smart Timetable Generator – Sprint 3
--  Created : 2026-03-17
--  NOTE    : All pre-existing tables are left untouched.
-- ============================================================

CREATE TABLE IF NOT EXISTS substitution_requests (
    id                  INT             NOT NULL AUTO_INCREMENT,
    absent_faculty_id   INT             NOT NULL,   -- FK → faculty.id
    date                DATE            NOT NULL,   -- date of absence
    period              VARCHAR(50)     NOT NULL,   -- e.g. '9:00 AM - 10:00 AM'
    requested_faculty_id INT            NOT NULL,   -- FK → faculty.id (substitute)
    deadline            DATETIME        NOT NULL,   -- response deadline
    status              ENUM(
                            'pending',
                            'accepted',
                            'declined',
                            'expired'
                        )               NOT NULL DEFAULT 'pending',

    PRIMARY KEY (id),

    CONSTRAINT fk_absent_faculty
        FOREIGN KEY (absent_faculty_id)
        REFERENCES faculty(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT fk_requested_faculty
        FOREIGN KEY (requested_faculty_id)
        REFERENCES faculty(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- ============================================================
--  Indexes for common look-ups
-- ============================================================

-- quickly find all requests for an absent faculty on a date
CREATE INDEX idx_absent_faculty_date
    ON substitution_requests (absent_faculty_id, date);

-- quickly find pending requests assigned to a faculty
CREATE INDEX idx_requested_faculty_status
    ON substitution_requests (requested_faculty_id, status);

-- quickly find requests whose deadline has passed (for expiry jobs)
CREATE INDEX idx_deadline
    ON substitution_requests (deadline);
