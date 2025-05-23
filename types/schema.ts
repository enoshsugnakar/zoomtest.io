export type QuestionType = 'multiple_choice' | 'behavioral';

export interface Question {
  id: string;
  test_id: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  order_number: number;
  type: QuestionType;
  created_at: string;
  updated_at: string;
}

export interface CandidateResponse {
  id: string;
  test_session_id: string;
  question_id: string;
  response: string | null;
  file_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TestConfig {
  id: string;
  test_id: string;
  allow_file_upload: boolean;
  file_upload_limit: number | null;
  created_at: string;
  updated_at: string;
}