import { supabase } from "@/lib/supabase";
import { fetchAllRows } from "@/lib/fetchAll";
import { cached, invalidateCache } from "@/lib/cache";
import type { CandidaturaFreelancer, Freelancer, VagaFreelancer } from "./engine";

// -----------------------------------------------------------------------
// lado STAFF — visão completa (RLS libera tudo pra quem tem core.membership)
// -----------------------------------------------------------------------
export interface FreelancersStaffData {
  freelancers: Freelancer[];
  vagas: VagaFreelancer[];
  candidaturas: CandidaturaFreelancer[];
}

async function loadFreelancersStaffUncached(): Promise<FreelancersStaffData> {
  const [freelancers, vagas, candidaturas] = await Promise.all([
    fetchAllRows<Freelancer>("freelancers"),
    fetchAllRows<VagaFreelancer>("vagas_freelancer"),
    fetchAllRows<CandidaturaFreelancer>("candidaturas_freelancer"),
  ]);
  return { freelancers, vagas, candidaturas };
}

export function loadFreelancersStaffData(): Promise<FreelancersStaffData> {
  return cached("freelancers-staff", loadFreelancersStaffUncached);
}

export function invalidateFreelancersStaffCache() {
  invalidateCache("freelancers-staff");
}

// -----------------------------------------------------------------------
// lado FREELANCER — só o próprio perfil, vagas abertas e próprias
// candidaturas (RLS restringe o resto sozinho)
// -----------------------------------------------------------------------

export async function fetchMeuPerfil(userId: string): Promise<Freelancer | null> {
  const { data, error } = await supabase
    .from("freelancers")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Freelancer | null;
}

export async function fetchVagasAbertas(): Promise<VagaFreelancer[]> {
  const { data, error } = await supabase
    .from("vagas_freelancer")
    .select("*")
    .eq("status", "aberta")
    .order("data", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VagaFreelancer[];
}

export async function fetchMinhasCandidaturas(userId: string): Promise<CandidaturaFreelancer[]> {
  const { data, error } = await supabase
    .from("candidaturas_freelancer")
    .select("*")
    .eq("freelancer_id", userId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CandidaturaFreelancer[];
}
