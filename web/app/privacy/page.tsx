export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-white">
      <p className="text-xs uppercase tracking-[0.18em] text-cyan-100/50">
        Octoson
      </p>

      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em]">
        Məxfilik
      </h1>

      <div className="mt-10 space-y-8 text-sm leading-7 text-white/55">
        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Hansı məlumatlar işlənir
          </h2>
          <p className="mt-2">
            Discord ilə giriş zamanı Discord istifadəçi identifikatoru,
            profil adı, profil şəkli və autentifikasiya üçün lazım olan
            sessiya məlumatları işlənə bilər.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Octoson məlumatları
          </h2>
          <p className="mt-2">
            Virtual Aura balansı, bank balansı, XP, səviyyə, oyun
            nəticələri, inventar, statistikalar və təhlükəsizlik və
            moderasiya üçün lazım olan məlumatlar saxlanıla bilər.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Məqsəd
          </h2>
          <p className="mt-2">
            Bu məlumatlar hesabın tanınması, Octoson funksiyalarının
            işləməsi, virtual iqtisadiyyatın sinxronlaşdırılması,
            təhlükəsizlik, sui-istifadənin qarşısının alınması və
            moderasiya məqsədləri üçün istifadə olunur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Xidmət təminatçıları
          </h2>
          <p className="mt-2">
            Octoson texniki xidmət üçün Discord və Supabase kimi
            xidmətlərdən istifadə edə bilər. Bu xidmətlər öz məxfilik
            qaydalarına uyğun olaraq məlumat emal edə bilər.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Saxlama müddəti
          </h2>
          <p className="mt-2">
            Məlumatlar xidmətin göstərilməsi, təhlükəsizlik,
            moderasiya və qanuni öhdəliklər üçün lazım olduğu müddətə
            qədər saxlanılır.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Hüquqlarınız
          </h2>
          <p className="mt-2">
            Tətbiq olunan məlumat qoruma qanunlarına əsasən məlumatlara
            çıxış, düzəliş, silinmə, emalın məhdudlaşdırılması,
            etiraz və məlumat daşınması kimi hüquqlarınız ola bilər.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white/85">
            Əlaqə
          </h2>
          <p className="mt-2">
            Məxfilik sorğuları üçün Impressum səhifəsində göstərilən
            əlaqə vasitəsindən istifadə edin.
          </p>
        </section>
      </div>
    </main>
  );
}
