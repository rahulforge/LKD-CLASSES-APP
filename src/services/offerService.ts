import { supabase } from "../../lib/supabase";

export type ActiveOffer = {
  id: string;
  title: string;
  description: string;
  price: number;
  valid_till: string;
  registration_link: string;
};

export const offerService = {
  async getActiveOffers(limit = 5): Promise<ActiveOffer[]> {
    const today = new Date().toISOString();
    const { data, error } = await supabase
      .from("offers")
      .select(
        "id, title, description, price, valid_till, registration_link"
      )
      .eq("is_active", true)
      .gte("valid_till", today)
      .order("valid_till", { ascending: true })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data as ActiveOffer[];
  },
};