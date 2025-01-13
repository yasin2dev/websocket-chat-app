-- FOR CREATE CHATS TABLE IN POSTGRESQL - CAN DO IN pgAdmin 4.
-- POSTGRESQL VERSION: 17

CREATE TABLE public.chats
(
    qn bigint NOT NULL,
    author character varying(100) NOT NULL,
    msg text NOT NULL,
    id uuid,
    "time" text NOT NULL,
    PRIMARY KEY (qn)
);