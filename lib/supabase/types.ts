export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          display_name: string | null
          starting_bankroll: number
          current_bankroll: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          starting_bankroll?: number
          current_bankroll?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          starting_bankroll?: number
          current_bankroll?: number
          created_at?: string
          updated_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: 'user' | 'assistant'
          content?: string
          created_at?: string
        }
      }
      bets: {
        Row: {
          id: string
          user_id: string
          conversation_id: string | null
          sport: string
          league: string
          game_description: string
          bet_type: string
          bet_side: string
          odds: number
          stake: number
          potential_win: number
          actual_result: number | null
          book: string
          status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
          placed_at: string
          settled_at: string | null
          game_time: string | null
          closing_odds: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          conversation_id?: string | null
          sport: string
          league: string
          game_description: string
          bet_type: string
          bet_side: string
          odds: number
          stake: number
          potential_win: number
          actual_result?: number | null
          book: string
          status?: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
          placed_at?: string
          settled_at?: string | null
          game_time?: string | null
          closing_odds?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          conversation_id?: string | null
          sport?: string
          league?: string
          game_description?: string
          bet_type?: string
          bet_side?: string
          odds?: number
          stake?: number
          potential_win?: number
          actual_result?: number | null
          book?: string
          status?: 'pending' | 'won' | 'lost' | 'push' | 'cancelled'
          placed_at?: string
          settled_at?: string | null
          game_time?: string | null
          closing_odds?: number | null
          notes?: string | null
          created_at?: string
        }
      }
      bankroll_snapshots: {
        Row: {
          id: string
          user_id: string
          balance: number
          snapshot_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance: number
          snapshot_date: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          snapshot_date?: string
          created_at?: string
        }
      }
      custom_models: {
        Row: {
          id: string
          user_id: string
          model_name: string
          sport_key: string
          market_type: string
          target_metric: string
          confidence_level: number
          config: Json
          notes: string | null
          created_at: string
          updated_at: string
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          model_name: string
          sport_key: string
          market_type: string
          target_metric: string
          confidence_level?: number
          config: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          model_name?: string
          sport_key?: string
          market_type?: string
          target_metric?: string
          confidence_level?: number
          config?: Json
          notes?: string | null
          created_at?: string
          updated_at?: string
          last_used_at?: string | null
        }
      }
    }
  }
}
