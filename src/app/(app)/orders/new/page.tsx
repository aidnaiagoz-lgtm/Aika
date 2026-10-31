import Link from "next/link";
import { Card } from "@/lib/ui";
import { listProducts, listMaterials } from "@/lib/domain/orders";
import { getCurrentUser } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { tr } from "@/lib/tr";
import { prisma } from "@/lib/db";
import { SOURCE_OPTIONS, formatTenge } from "@/lib/order-labels";
import { createOrderAction } from "../actions";
import { PhoneDuplicateCheck } from "./PhoneDuplicateCheck";
import { VehicleMakeModelFields } from "./VehicleMakeModelFields";

const PRODUCT_ROW_COUNT = 3;
// Бұл екі тізім еркін мәтін ретінде тікелей БД-ге жазылады (enum емес), сондықтан
// тұрақтылық үшін тек қазақша нұсқасында қалдырылды — Order детальды бетінде де
// осы дәл мәтінмен көрсетіледі.
const COMPLECTATION_OPTIONS = ["Тек жүргізуші орны", "Алдыңғы қатар", "Толық 2 қатар", "Толық 3 қатар", "Багажник", "Толық жинақ"];
const REMOVABLE_MAT_OPTIONS = ["EVA", "Кілем", "Леска", "Басқа"];
// Марка атаулары — Қазақстан нарығында кең тараған брэндтер (ең жиі кездесетіндері
// алдында), аудармасыз, тек ұсыныс (datalist) үшін, өріс еркін мәтін болып қалады.
const CAR_MAKES = [
  // ҚР-да ең көп таралған
  "Lada (ВАЗ)",
  "Toyota",
  "Hyundai",
  "Kia",
  "Chevrolet",
  "Ravon",
  "Lexus",
  "Nissan",
  "Volkswagen",
  "BMW",
  "Mercedes-Benz",
  "Renault",
  "Skoda",
  "Mazda",
  "Honda",
  "Mitsubishi",
  "Subaru",
  "Suzuki",
  "Ford",
  "Opel",
  "Audi",
  // Қытай брендтері (соңғы жылдары ҚР нарығында тез өсуде)
  "Chery",
  "Geely",
  "Haval",
  "Changan",
  "Great Wall",
  "Tank",
  "Exeed",
  "Omoda",
  "JAECOO",
  "JAC",
  "BYD",
  "Hongqi",
  "FAW",
  "Dongfeng",
  "GAC",
  "Foton",
  "Zeekr",
  "Livan",
  // ТМД / орыс брендтері
  "GAZ",
  "UAZ",
  "Moskvich",
  "Daewoo",
  "Datsun",
  // Басқа еуропалық/американдық/премиум
  "Peugeot",
  "Citroen",
  "Fiat",
  "Seat",
  "Volvo",
  "Land Rover",
  "Jaguar",
  "Mini",
  "Porsche",
  "Cadillac",
  "Jeep",
  "Chrysler",
  "Dodge",
  "GMC",
  "Lincoln",
  "Infiniti",
  "Genesis",
  "SsangYong",
  "Isuzu",
  "Tesla",
  // Толық тізім — қалған әлемдік брендтер
  "Alfa Romeo",
  "Lancia",
  "Maserati",
  "Ferrari",
  "Lamborghini",
  "Bugatti",
  "Bentley",
  "Rolls-Royce",
  "Aston Martin",
  "McLaren",
  "Dacia",
  "Cupra",
  "DS Automobiles",
  "Alpine",
  "Smart",
  "Saab",
  "Abarth",
  "Buick",
  "Pontiac",
  "Hummer",
  "RAM",
  "Saturn",
  "Mercury",
  "Plymouth",
  "Scion",
  "Daihatsu",
  "Maruti Suzuki",
  "Tata",
  "Mahindra",
  "Proton",
  "Perodua",
  "MG",
  "Wuling",
  "Baojun",
  "Roewe",
  "Lynk & Co",
  "Polestar",
  "NIO",
  "XPeng",
  "Li Auto",
  "Aiways",
  "Voyah",
  "Denza",
  "Arcfox",
  "Skyworth",
  "Bestune",
  "Forthing",
  "Soueast",
  "DFSK",
  "Maxus (LDV)",
  "Ora",
  "Deepal",
  "Belgee",
];

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const t = (kk: string, ru: string) => tr(locale, { kk, ru });
  const { error } = await searchParams;

  const [products, materials, recentCustomers, recentVehicles] = await Promise.all([
    listProducts(),
    listMaterials(),
    prisma.customer.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.customerCar.findMany({ orderBy: { id: "desc" }, take: 50, include: { customer: true } }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text-primary">{t("Жаңа заказ", "Новый заказ")}</h1>
        <Link href="/orders" className="text-sm font-medium text-accent hover:underline">
          {t("← Заказдарға оралу", "← Назад к заказам")}
        </Link>
      </div>

      {error && (
        <div className="rounded-icon border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <form action={createOrderAction} className="flex flex-col gap-4">
        <Card title={t("Клиент", "Клиент")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("Бар клиент (телефон бойынша)", "Существующий клиент (по телефону)")}>
              <select name="customerId" className={selectClass}>
                <option value="">{t("— Жаңа клиент —", "— Новый клиент —")}</option>
                {recentCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} · {c.phone}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Аты-жөні (жаңа болса)", "ФИО (если новый)")}>
              <input name="customerFullName" className={inputClass} />
            </Field>
            <Field label={t("Телефон (жаңа болса)", "Телефон (если новый)")}>
              <PhoneDuplicateCheck />
            </Field>
            <Field label="WhatsApp">
              <input name="customerWhatsapp" className={inputClass} />
            </Field>
            <Field label={t("Қала", "Город")}>
              <input name="customerCity" className={inputClass} />
            </Field>
            <Field label={t("Клиент түрі", "Тип клиента")}>
              <select name="customerClientType" defaultValue="INDIVIDUAL" className={selectClass}>
                <option value="INDIVIDUAL">{t("Жеке тұлға", "Физ. лицо")}</option>
                <option value="COMPANY">{t("Компания", "Компания")}</option>
              </select>
            </Field>
            <Field label={t("VIP клиент", "VIP клиент")}>
              <YesNoSelect name="customerIsVip" locale={locale} />
            </Field>
            <Field label={t("Дереккөз (канал обращения)", "Источник (канал обращения)")}>
              <select name="source" className={selectClass}>
                <option value="">—</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Канал продаж", "Канал продаж")}>
              <select name="salesChannel" className={selectClass}>
                <option value="">—</option>
                {SOURCE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Сертификат нөмірі", "Номер сертификата")}>
              <input name="certificateNo" className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card title={t("Көлік", "Автомобиль")}>
          <p className="mb-3 text-xs text-text-secondary">
            {t(
              "Клиент қайта келсе — бұрынғы көлігін таңдаңыз (тізім соңғы 50 көлікті көрсетеді). Таңдалса, төмендегі жаңа көлік өрістері еленбейді.",
              "Если клиент постоянный — выберите его прошлый автомобиль (список показывает последние 50). Если выбран, поля нового авто ниже игнорируются."
            )}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t("Бар көлік", "Существующий автомобиль")}>
              <select name="vehicleId" className={selectClass}>
                <option value="">{t("— Жаңа көлік —", "— Новый автомобиль —")}</option>
                {recentVehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.customer.fullName} · {v.make} {v.model} {v.year ?? ""}
                  </option>
                ))}
              </select>
            </Field>
            <VehicleMakeModelFields
              makeLabel={t("Марка (жаңа болса)", "Марка (если новый)")}
              modelLabel={t("Модель", "Модель")}
              yearLabel={t("Шығарылған жылы", "Год выпуска")}
              generationLabel={t("Generation (мыс. XV70)", "Поколение (напр. XV70)")}
              makePlaceholder="Toyota"
              modelPlaceholder="Camry"
              carMakes={CAR_MAKES}
            />
            <Field label={t("Кузов", "Кузов")}>
              <input name="vehicleBody" className={inputClass} />
            </Field>
            <Field label={t("Қатар саны", "Количество рядов")}>
              <input name="vehicleRows" type="number" min={1} max={3} className={inputClass} />
            </Field>
            <Field label={t("Руль жағы", "Сторона руля")}>
              <select name="vehicleSteering" className={selectClass}>
                <option value="">—</option>
                <option value="LEFT">{t("Сол жақ", "Левый")}</option>
                <option value="RIGHT">{t("Оң жақ", "Правый")}</option>
              </select>
            </Field>
            <Field label={t("VIN (міндетті емес)", "VIN (не обязательно)")}>
              <input name="vehicleVin" className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card title={t("Тауарлар және конфигурация", "Товары и конфигурация")}>
          <div className="flex flex-col gap-5">
            {Array.from({ length: PRODUCT_ROW_COUNT }).map((_, i) => (
              <div key={i} className="rounded-icon border border-border p-3">
                <div className="grid grid-cols-[1fr_100px] gap-3">
                  <Field label={t(`Тауар ${i + 1}`, `Товар ${i + 1}`)}>
                    <select name="productId" className={selectClass}>
                      <option value="">—</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatTenge(p.basePrice)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("Саны", "Кол-во")}>
                    <input name="qty" type="number" min={1} defaultValue={1} className={inputClass} />
                  </Field>
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-accent">
                    {t("Комплектация (Автополик болса) ▾", "Комплектация (если Автополик) ▾")}
                  </summary>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label={t("Комплектация", "Комплектация")}>
                      <select name="configComplectation" className={selectClass}>
                        <option value="">—</option>
                        {COMPLECTATION_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("Материал (Кожа)", "Материал (кожа)")}>
                      <select name="configMaterialId" className={selectClass}>
                        <option value="">—</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} · {m.color}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("Түсі", "Цвет")}>
                      <input name="configColor" className={inputClass} />
                    </Field>
                    <Field label={t("Өрнек", "Узор")}>
                      <input name="configPattern" className={inputClass} />
                    </Field>
                    <Field label={t("Жіп түсі", "Цвет нити")}>
                      <input name="configThreadColor" className={inputClass} />
                    </Field>
                    <Field label={t("Кант түсі", "Цвет окантовки")}>
                      <input name="configEdgingColor" className={inputClass} />
                    </Field>
                    <Field label={t("Сьемный полик түрі", "Тип съёмного коврика")}>
                      <select name="configRemovableMatType" className={selectClass}>
                        <option value="">—</option>
                        {REMOVABLE_MAT_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={t("Полик түсі", "Цвет коврика")}>
                      <input name="configRemovableMatColor" className={inputClass} />
                    </Field>
                    <Field label={t("Полик жіп түсі", "Нитка коврика")}>
                      <input name="configRemovableMatThreadColor" className={inputClass} />
                    </Field>
                    <Field label={t("Полик канты", "Окантовка коврика")}>
                      <input name="configRemovableMatEdging" className={inputClass} />
                    </Field>
                    <Field label={t("Подпятник", "Подпятник")}>
                      <YesNoSelect name="configHeelPad" locale={locale} />
                    </Field>
                    <Field label={t("Кармашки", "Карманы")}>
                      <YesNoSelect name="configPockets" locale={locale} />
                    </Field>
                    <Field label={t("Кармашки саны (пар)", "Карманы, сколько пар")}>
                      <input name="configPocketsPairs" type="number" min={0} className={inputClass} />
                    </Field>
                    <Field label={t("Кармашки логосы", "Лого на карманах")}>
                      <YesNoSelect name="configPocketsLogo" locale={locale} />
                    </Field>
                    <Field label={t("Лого", "Лого")}>
                      <YesNoSelect name="configLogo" locale={locale} />
                    </Field>
                    <Field label={t("Custom лого мәтіні", "Текст лого")}>
                      <input name="configCustomLogoText" className={inputClass} />
                    </Field>
                    <Field label={t("Вышивка", "Вышивка")}>
                      <YesNoSelect name="configEmbroidery" locale={locale} />
                    </Field>
                    <Field label={t("Қосымша аксессуарлар", "Доп. аксессуары")}>
                      <input name="configExtraAccessories" className={inputClass} />
                    </Field>
                  </div>
                </details>
              </div>
            ))}
            <p className="text-xs text-text-secondary">{t("Толтырылмаған тауар жолдары еленбейді.", "Незаполненные строки товара игнорируются.")}</p>
          </div>
        </Card>

        <Card title={t("Скидка / Приоритет", "Скидка / Приоритет")}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t("Скидка, %", "Скидка, %")}>
              <input name="requestedDiscountPct" type="number" min={0} max={100} step="0.1" className={inputClass} />
            </Field>
            <Field label={t("Приоритет", "Приоритет")}>
              <select name="priority" defaultValue="NORMAL" className={selectClass}>
                <option value="LOW">{t("Төмен", "Низкий")}</option>
                <option value="NORMAL">{t("Қалыпты", "Обычный")}</option>
                <option value="HIGH">{t("Жоғары", "Высокий")}</option>
                <option value="URGENT">{t("Шұғыл", "Срочный")}</option>
              </select>
            </Field>
            <Field label={t("Комментарий", "Комментарий")}>
              <input name="comment" className={inputClass} />
            </Field>
            <Field label={t("Дедлайн (дайын болу мерзімі)", "Дедлайн (срок готовности)")}>
              <input name="deadline" type="date" className={inputClass} />
            </Field>
            <Field label={t("Менеджер бонусы", "Бонус менеджера")}>
              <input name="managerBonus" type="number" min={0} className={inputClass} />
            </Field>
          </div>
        </Card>

        <Card title={t("Жеткізу түрі", "Тип доставки")}>
          <div className="flex flex-col gap-3">
            <Field label={t("Түрі", "Тип")}>
              <select name="fulfillmentType" className={selectClass}>
                <option value="">—</option>
                <option value="INSTALLATION">{t("Орнату", "Установка")}</option>
                <option value="DELIVERY">{t("Доставка", "Доставка")}</option>
                <option value="PICKUP">{t("Өзі алып кету", "Самовывоз")}</option>
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("Орнату күні/уақыты", "Дата/время установки")}>
                <input name="installationDate" type="datetime-local" className={inputClass} />
              </Field>
              <Field label={t("Доставка мекенжайы", "Адрес доставки")}>
                <input name="deliveryAddress" className={inputClass} />
              </Field>
              <Field label={t("Доставка қаласы", "Город доставки")}>
                <input name="deliveryCity" placeholder={t("Қала", "Город")} className={inputClass} />
              </Field>
            </div>
          </div>
        </Card>

        <button
          type="submit"
          className="sticky bottom-4 w-fit rounded-pill bg-accent px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-accent-hover"
        >
          {t("Заказды сақтау", "Сохранить заказ")}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";
const selectClass = inputClass;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-text-secondary">{label}</label>
      {children}
    </div>
  );
}

function YesNoSelect({ name, locale }: { name: string; locale: "kk" | "ru" }) {
  return (
    <select name={name} defaultValue="no" className={selectClass}>
      <option value="no">{tr(locale, { kk: "Жоқ", ru: "Нет" })}</option>
      <option value="yes">{tr(locale, { kk: "Иә", ru: "Да" })}</option>
    </select>
  );
}
