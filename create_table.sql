CREATE TABLE IF NOT EXISTS chat_history ( 
     id SERIAL PRIMARY KEY, 
     session_id TEXT NOT NULL, 
     message JSONB NOT NULL, 
     created_at TIMESTAMPTZ DEFAULT NOW() 
 );