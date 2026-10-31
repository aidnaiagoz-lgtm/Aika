"use client";

import { useState } from "react";

// Ең көп сатылатын/жиі кездесетін маркалардың танымал модельдері. Марка тізімде
// жоқ болса да (немесе моделі жоқ болса) өріс еркін мәтін болып қалады — тек
// қолжетімді болса ұсыныс (datalist) көрсетіледі.
const MAKE_MODELS: Record<string, string[]> = {
  "Lada (ВАЗ)": ["Granta", "Vesta", "Niva Legend", "Niva Travel", "XRAY", "Largus", "Priora", "Kalina", "2107", "2114", "2115"],
  Toyota: ["Camry", "Corolla", "RAV4", "Land Cruiser", "Land Cruiser Prado", "Highlander", "Fortuner", "Hilux", "Yaris", "C-HR", "Avalon", "Venza"],
  Hyundai: ["Tucson", "Santa Fe", "Elantra", "Sonata", "Accent", "Creta", "Solaris", "Palisade", "Staria", "i30"],
  Kia: ["Sportage", "Sorento", "Rio", "Cerato", "K5", "Seltos", "Soul", "Carnival", "Optima"],
  Chevrolet: ["Cobalt", "Nexia", "Lacetti", "Malibu", "Captiva", "Tracker", "Onix", "Aveo", "Spark", "TrailBlazer"],
  Ravon: ["R2", "R3", "R4", "Nexia", "Gentra"],
  Lexus: ["RX", "LX", "ES", "NX", "GX", "LS", "UX"],
  Nissan: ["X-Trail", "Qashqai", "Almera", "Teana", "Patrol", "Murano", "Terrano", "Note", "Juke"],
  Volkswagen: ["Polo", "Passat", "Tiguan", "Jetta", "Touareg", "Golf", "Teramont"],
  BMW: ["3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X6"],
  "Mercedes-Benz": ["C-Class", "E-Class", "S-Class", "GLA", "GLC", "GLE", "G-Class"],
  Mazda: ["3", "6", "CX-5", "CX-9", "CX-30"],
  Honda: ["CR-V", "Civic", "Accord", "Pilot", "HR-V"],
  Mitsubishi: ["Outlander", "ASX", "Pajero", "Pajero Sport", "L200"],
  Renault: ["Duster", "Logan", "Sandero", "Arkana", "Kaptur"],
  Skoda: ["Octavia", "Rapid", "Kodiaq", "Karoq", "Superb"],
  Ford: ["Focus", "Explorer", "Kuga", "EcoSport", "Mustang"],
  Audi: ["A4", "A6", "Q3", "Q5", "Q7"],
  Chery: ["Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo"],
  Geely: ["Coolray", "Atlas", "Emgrand", "Monjaro"],
  Haval: ["Jolion", "F7", "Dargo", "H6"],
  Changan: ["CS35", "CS55", "CS75", "Uni-K"],
  "Great Wall": ["Poer", "Wingle"],
  Tank: ["300", "500"],
  GAZ: ["Gazelle", "Volga"],
  UAZ: ["Patriot", "Hunter"],
};

interface GenEntry {
  code: string;
  from: number;
  to: number | null; // null = әлі шығарылады
}

// Тек нақты сенімді, кеңінен танымал буын кодтары мен жылдар ғана қосылған —
// белгісіз/даулы модельдер үшін бос қалдырылды (қате ақпарат берместен, өріс
// жәй еркін мәтін болып қалады).
const MODEL_GENERATIONS: Record<string, Record<string, GenEntry[]>> = {
  Toyota: {
    Camry: [
      { code: "XV40", from: 2006, to: 2011 },
      { code: "XV50", from: 2011, to: 2017 },
      { code: "XV70", from: 2017, to: 2023 },
      { code: "XV80", from: 2023, to: null },
    ],
    Corolla: [
      { code: "E140/150", from: 2006, to: 2013 },
      { code: "E160/170", from: 2013, to: 2019 },
      { code: "E210", from: 2019, to: null },
    ],
    RAV4: [
      { code: "XA30", from: 2005, to: 2013 },
      { code: "XA40", from: 2013, to: 2018 },
      { code: "XA50", from: 2018, to: null },
    ],
    "Land Cruiser Prado": [
      { code: "J120", from: 2002, to: 2009 },
      { code: "J150", from: 2009, to: 2024 },
      { code: "J250", from: 2024, to: null },
    ],
    "Land Cruiser": [
      { code: "J200", from: 2007, to: 2021 },
      { code: "J300", from: 2021, to: null },
    ],
    Highlander: [
      { code: "XU40", from: 2007, to: 2013 },
      { code: "XU50", from: 2013, to: 2019 },
      { code: "XU70", from: 2019, to: null },
    ],
    Hilux: [{ code: "AN120/130", from: 2015, to: null }],
  },
  Hyundai: {
    Tucson: [
      { code: "JM", from: 2004, to: 2009 },
      { code: "LM", from: 2009, to: 2015 },
      { code: "TL", from: 2015, to: 2020 },
      { code: "NX4", from: 2020, to: null },
    ],
    "Santa Fe": [
      { code: "CM", from: 2006, to: 2012 },
      { code: "DM", from: 2012, to: 2018 },
      { code: "TM", from: 2018, to: 2023 },
      { code: "MX5", from: 2023, to: null },
    ],
    Elantra: [
      { code: "HD", from: 2006, to: 2010 },
      { code: "MD", from: 2010, to: 2015 },
      { code: "AD", from: 2015, to: 2020 },
      { code: "CN7", from: 2020, to: null },
    ],
    Sonata: [
      { code: "NF", from: 2004, to: 2009 },
      { code: "YF", from: 2009, to: 2014 },
      { code: "LF", from: 2014, to: 2019 },
      { code: "DN8", from: 2019, to: null },
    ],
    Accent: [
      { code: "MC", from: 2005, to: 2010 },
      { code: "RB", from: 2010, to: 2017 },
      { code: "HC", from: 2017, to: null },
    ],
  },
  Kia: {
    Sportage: [
      { code: "KM", from: 2004, to: 2010 },
      { code: "SL", from: 2010, to: 2015 },
      { code: "QL", from: 2015, to: 2021 },
      { code: "NQ5", from: 2021, to: null },
    ],
    Sorento: [
      { code: "BL", from: 2002, to: 2009 },
      { code: "XM", from: 2009, to: 2014 },
      { code: "UM", from: 2014, to: 2020 },
      { code: "MQ4", from: 2020, to: null },
    ],
    Rio: [
      { code: "JB", from: 2005, to: 2011 },
      { code: "UB", from: 2011, to: 2017 },
      { code: "YB", from: 2017, to: 2023 },
      { code: "SC", from: 2023, to: null },
    ],
    Cerato: [
      { code: "TD", from: 2008, to: 2013 },
      { code: "YD", from: 2013, to: 2018 },
      { code: "BD", from: 2018, to: null },
    ],
  },
  Nissan: {
    "X-Trail": [
      { code: "T30", from: 2000, to: 2007 },
      { code: "T31", from: 2007, to: 2014 },
      { code: "T32", from: 2013, to: 2022 },
      { code: "T33", from: 2022, to: null },
    ],
    Qashqai: [
      { code: "J10", from: 2006, to: 2013 },
      { code: "J11", from: 2013, to: 2021 },
      { code: "J12", from: 2021, to: null },
    ],
  },
  BMW: {
    "3 Series": [
      { code: "E90", from: 2005, to: 2012 },
      { code: "F30", from: 2012, to: 2019 },
      { code: "G20", from: 2019, to: null },
    ],
    "5 Series": [
      { code: "E60", from: 2003, to: 2010 },
      { code: "F10", from: 2010, to: 2017 },
      { code: "G30", from: 2017, to: 2023 },
      { code: "G60", from: 2023, to: null },
    ],
  },
  "Mercedes-Benz": {
    "C-Class": [
      { code: "W203", from: 2000, to: 2007 },
      { code: "W204", from: 2007, to: 2014 },
      { code: "W205", from: 2014, to: 2021 },
      { code: "W206", from: 2021, to: null },
    ],
    "E-Class": [
      { code: "W211", from: 2002, to: 2009 },
      { code: "W212", from: 2009, to: 2016 },
      { code: "W213", from: 2016, to: 2023 },
      { code: "W214", from: 2023, to: null },
    ],
  },
  Volkswagen: {
    Passat: [
      { code: "B6", from: 2005, to: 2010 },
      { code: "B7", from: 2010, to: 2014 },
      { code: "B8", from: 2014, to: null },
    ],
    Tiguan: [
      { code: "5N", from: 2007, to: 2016 },
      { code: "AD1", from: 2016, to: null },
    ],
  },
  Mazda: {
    "3": [
      { code: "BK", from: 2003, to: 2009 },
      { code: "BL", from: 2009, to: 2013 },
      { code: "BM", from: 2013, to: 2018 },
      { code: "BP", from: 2018, to: null },
    ],
    "6": [
      { code: "GG", from: 2002, to: 2007 },
      { code: "GH", from: 2007, to: 2012 },
      { code: "GJ", from: 2012, to: 2018 },
      { code: "GL", from: 2018, to: null },
    ],
    "CX-5": [
      { code: "KE", from: 2012, to: 2016 },
      { code: "KF", from: 2016, to: null },
    ],
  },
  Honda: {
    "CR-V": [
      { code: "RE", from: 2006, to: 2012 },
      { code: "RM", from: 2012, to: 2016 },
      { code: "RW", from: 2017, to: 2022 },
      { code: "RS", from: 2022, to: null },
    ],
    Civic: [
      { code: "FD", from: 2005, to: 2011 },
      { code: "FB", from: 2011, to: 2015 },
      { code: "FC", from: 2015, to: 2021 },
      { code: "FL", from: 2021, to: null },
    ],
  },
};

function matchingGenerations(make: string, model: string, year: number | null): GenEntry[] {
  const entries = MODEL_GENERATIONS[make]?.[model];
  if (!entries) return [];
  if (year === null) return entries;
  return entries.filter((e) => year >= e.from && (e.to === null || year <= e.to));
}

export function VehicleMakeModelFields({
  makeLabel,
  modelLabel,
  yearLabel,
  generationLabel,
  makePlaceholder,
  modelPlaceholder,
  carMakes,
}: {
  makeLabel: string;
  modelLabel: string;
  yearLabel: string;
  generationLabel: string;
  makePlaceholder: string;
  modelPlaceholder: string;
  carMakes: string[];
}) {
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [generation, setGeneration] = useState("");

  const models = MAKE_MODELS[make] ?? [];
  const genOptions = matchingGenerations(make, model, year);

  function updateYear(value: string) {
    const y = value ? Number(value) : null;
    setYear(y);
    const matches = matchingGenerations(make, model, y);
    if (matches.length === 1) setGeneration(matches[0].code);
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">{makeLabel}</label>
        <input
          name="vehicleMake"
          list="vehicleMakeList"
          autoComplete="off"
          value={make}
          onChange={(e) => {
            setMake(e.target.value);
            setGeneration("");
          }}
          className={inputClass}
          placeholder={makePlaceholder}
        />
        <datalist id="vehicleMakeList">
          {carMakes.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">{modelLabel}</label>
        <input
          name="vehicleModel"
          list="vehicleModelList"
          autoComplete="off"
          value={model}
          onChange={(e) => {
            setModel(e.target.value);
            setGeneration("");
          }}
          className={inputClass}
          placeholder={modelPlaceholder}
        />
        <datalist id="vehicleModelList">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">{yearLabel}</label>
        <input name="vehicleYear" type="number" value={year ?? ""} onChange={(e) => updateYear(e.target.value)} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-text-secondary">{generationLabel}</label>
        <input
          name="vehicleGeneration"
          list="vehicleGenerationList"
          autoComplete="off"
          value={generation}
          onChange={(e) => setGeneration(e.target.value)}
          className={inputClass}
        />
        <datalist id="vehicleGenerationList">
          {genOptions.map((g) => (
            <option key={g.code} value={g.code} />
          ))}
        </datalist>
      </div>
    </>
  );
}

const inputClass =
  "rounded-icon border border-border bg-page-bg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30";
