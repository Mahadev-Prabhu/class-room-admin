"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SchoolDetails } from "@/lib/types";

const COUNTRIES = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Cote d'Ivoire",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czechia",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming"
];

const INDIA_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon"
];

const AUSTRALIA_STATES = [
  "Australian Capital Territory", "New South Wales", "Northern Territory", "Queensland",
  "South Australia", "Tasmania", "Victoria", "Western Australia"
];

const UK_REGIONS = [
  "England", "Northern Ireland", "Scotland", "Wales"
];

const COUNTRY_REGIONS: Record<string, string[]> = {
  "Australia": AUSTRALIA_STATES,
  "Canada": CANADA_PROVINCES,
  "India": INDIA_STATES,
  "United Kingdom": UK_REGIONS,
  "United States": US_STATES,
};

const PHONE_FORMATS: Record<string, { code: string; placeholder: string }> = {
  "Australia": { code: "+61", placeholder: "+61 4 1234 5678" },
  "Canada": { code: "+1", placeholder: "+1 (416) 123-4567" },
  "India": { code: "+91", placeholder: "+91 98765 43210" },
  "United Kingdom": { code: "+44", placeholder: "+44 7700 900123" },
  "United States": { code: "+1", placeholder: "+1 (555) 123-4567" },
};

function formatPhoneNumber(country: string, value: string) {
  const digits = value.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (country === "United States" || country === "Canada") {
    const localDigits = digits.startsWith("1") ? digits.slice(1, 11) : digits.slice(0, 10);
    if (localDigits.length <= 3) return `+1 ${localDigits}`;
    if (localDigits.length <= 6) return `+1 (${localDigits.slice(0, 3)}) ${localDigits.slice(3)}`;
    return `+1 (${localDigits.slice(0, 3)}) ${localDigits.slice(3, 6)}-${localDigits.slice(6)}`;
  }

  if (country === "India") {
    const localDigits = digits.startsWith("91") ? digits.slice(2, 12) : digits.slice(0, 10);
    if (localDigits.length <= 5) return `+91 ${localDigits}`;
    return `+91 ${localDigits.slice(0, 5)} ${localDigits.slice(5)}`;
  }

  if (country === "United Kingdom") {
    const localDigits = digits.startsWith("44") ? digits.slice(2, 12) : digits.slice(0, 10);
    if (localDigits.length <= 4) return `+44 ${localDigits}`;
    return `+44 ${localDigits.slice(0, 4)} ${localDigits.slice(4)}`;
  }

  if (country === "Australia") {
    const localDigits = digits.startsWith("61") ? digits.slice(2, 11) : digits.slice(0, 9);
    if (localDigits.length <= 1) return `+61 ${localDigits}`;
    if (localDigits.length <= 5) return `+61 ${localDigits.slice(0, 1)} ${localDigits.slice(1)}`;
    return `+61 ${localDigits.slice(0, 1)} ${localDigits.slice(1, 5)} ${localDigits.slice(5)}`;
  }

  return value;
}

export default function SetupPage() {
  const { user, admin, completeAdminSetup, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SchoolDetails>({
    school_name: "",
    country: "United States",
    state: "",
    address_1: "",
    address_2: "",
    zip_code: "",
    phone: "",
  });
  const selectedRegions = COUNTRY_REGIONS[formData.country] || [];
  const phoneFormat = PHONE_FORMATS[formData.country];

  useEffect(() => {
    if (loading) return;

    if (!user && !admin) {
      router.push("/login");
      return;
    }

    if (user && !admin) {
      return;
    }

    if (admin?.sign_in_details?.is_setup_complete) {
      router.push("/admin/dashboard");
    }
  }, [user, admin, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.school_name || !formData.state || !formData.address_1 || !formData.zip_code || !formData.phone) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);

    try {
      await completeAdminSetup(formData);
      toast.success("Setup completed successfully!");
      router.push("/admin/dashboard");
    } catch {
      toast.error("Failed to complete setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: keyof SchoolDetails, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCountryChange = (country: string) => {
    setFormData((prev) => ({
      ...prev,
      country,
      state: "",
      phone: "",
    }));
  };

  const handlePhoneChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      phone: formatPhoneNumber(prev.country, value),
    }));
  };

  if (loading || !admin || admin.sign_in_details?.is_setup_complete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100">
        <img
          src="/logo.png"
          alt="Early Learning Library"
          className="w-20 h-20 rounded-2xl animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-yellow-50 to-orange-100 p-4">
      <div className="w-full max-w-lg space-y-8">
        <h1 className="text-center text-2xl font-bold text-red-600 md:text-3xl">
          Welcome to the Early Learning Library Admin Portal!
        </h1>
        <Card className="shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img
                src="/logo.png"
                alt="Early Learning Library"
                className="w-20 h-20 rounded-2xl object-cover"
              />
            </div>
            <CardTitle className="text-2xl font-bold">Set Up Your School</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="school_name">School/Center Name *</Label>
                <Input
                  id="school_name"
                  placeholder="Head Start Learning Center"
                  value={formData.school_name}
                  onChange={(e) => handleChange("school_name", e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Select
                    value={formData.country}
                    onValueChange={handleCountryChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Region *</Label>
                  {selectedRegions.length > 0 ? (
                    <Select
                      value={formData.state}
                      onValueChange={(value) => handleChange("state", value)}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state/region" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedRegions.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="state"
                      placeholder="Enter state, province, or region"
                      value={formData.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_1">Street Address 1 *</Label>
                <Input
                  id="address_1"
                  placeholder="123 Main Street"
                  value={formData.address_1}
                  onChange={(e) => handleChange("address_1", e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_2">Street Address 2</Label>
                <Input
                  id="address_2"
                  placeholder="Suite 100 (optional)"
                  value={formData.address_2}
                  onChange={(e) => handleChange("address_2", e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zip_code">Zip Code *</Label>
                  <Input
                    id="zip_code"
                    placeholder="12345"
                    value={formData.zip_code}
                    onChange={(e) => handleChange("zip_code", e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone Number{phoneFormat ? ` (${phoneFormat.code})` : ""} *
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={phoneFormat?.placeholder || "+ country code phone number"}
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-6 bg-[#155C8A] text-white hover:bg-[#0F4D78]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Complete Setup"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
