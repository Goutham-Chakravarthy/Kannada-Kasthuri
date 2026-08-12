export interface Track {
  id: string;
  title: string;
  artist: string;
  film: string;
  year: number;
  duration: string;
  videoId: string;
}

export const tracks: Track[] = [
  { id: "1", title: "Naguva Nayana", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Pallavi Anu Pallavi", year: 1983, duration: "4:15", videoId: "AJSeaFthdeE" },
  { id: "2", title: "Jotheyali", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Geetha", year: 1981, duration: "4:30", videoId: "8HbwsAOfoRY" },
  { id: "3", title: "Ellelli Nodali", artist: "S. Janaki, Dr. Rajkumar", film: "Naa Ninna Mareyalaare", year: 1979, duration: "4:45", videoId: "6YqBP7N2j1o" },
  { id: "4", title: "Chinnada Mallige Hoove", artist: "S. Janaki, Dr. Rajkumar", film: "Huliya Haalina Mevu", year: 1979, duration: "4:20", videoId: "HxACdiw_bzg" },
  { id: "5", title: "Thanuvu Manavu", artist: "S. Janaki, Dr. Rajkumar", film: "Raja Nanna Raja", year: 1976, duration: "4:10", videoId: "0sllYbWGQ3Q" },
  { id: "6", title: "I Love You - Jeeva Hoovagide", artist: "S. Janaki, Dr. Rajkumar", film: "Nee Nanna Gellalare", year: 1981, duration: "4:50", videoId: "eDEGxCmbTvY" },
  { id: "7", title: "Nagunagutha Nee Baruve", artist: "S. Janaki, Dr. Rajkumar", film: "Giri Kanye", year: 1977, duration: "4:25", videoId: "8M0VCvCEZt0" },
  { id: "8", title: "Baani Gondu Elle", artist: "Dr. Rajkumar", film: "Prema Da Kaanike", year: 1976, duration: "4:35", videoId: "nZzTvbUa8AM" },
  { id: "9", title: "Naa Ninna Mareyalaare", artist: "S. Janaki, Dr. Rajkumar", film: "Naa Ninna Mareyalaare", year: 1979, duration: "4:40", videoId: "FD3UN6dELZg" },
  { id: "10", title: "Kelade Nimageega", artist: "S. P. Balasubrahmanyam", film: "Geetha", year: 1981, duration: "4:15", videoId: "bPRCdOKFHr4" },
  { id: "11", title: "Neerabittu Nelada Mele", artist: "S. P. Balasubrahmanyam", film: "Hombisilu", year: 1978, duration: "4:30", videoId: "PjYRNaAucg8" },
  { id: "12", title: "Aadisinodu Beelisinodu", artist: "P.B. Sreenivas", film: "Kasturi Nivasa", year: 1971, duration: "4:10", videoId: "8NJ-EY2GhIA" },
  { id: "13", title: "Yaare Neenu Cheluve", artist: "K J Yesudas", film: "Naanu Nanna Hendathi", year: 1985, duration: "4:50", videoId: "aj-qDonbd40" },
  { id: "14", title: "Yaava Huvvu Yaara Mudigo", artist: "S. P. Balasubrahmanyam", film: "Janma Janmada Anubandha", year: 1980, duration: "4:25", videoId: "ctUd5SF2Sx8" },
  { id: "15", title: "Nanna Neenu Gellalare", artist: "S. Janaki, Dr. Rajkumar", film: "Nee Nanna Gellalare", year: 1981, duration: "4:35", videoId: "5n6sK8tJ2rs" },
  { id: "16", title: "Nagutha Nagutha Baalu", artist: "Dr. Rajkumar", film: "Parashuram", year: 1989, duration: "4:20", videoId: "O-C2QsMecSA" },
  { id: "17", title: "Nee Bandu Ninthaaga", artist: "P.B. Sreenivas, P. Susheela", film: "Kasturi Nivasa", year: 1971, duration: "4:15", videoId: "iOffnc5po3U" },
  { id: "18", title: "Aakaashadindha", artist: "S. P. Balasubrahmanyam", film: "Chandanada Gombe", year: 1979, duration: "4:30", videoId: "AOk3QT8N74g" },
  { id: "19", title: "Sangeethave Nee Nudiyuna Maathella", artist: "S. Janaki, Dr. Rajkumar", film: "Olavu Gelavu", year: 1977, duration: "4:40", videoId: "fWEnOMqpm_k" },
  { id: "20", title: "Beladingalaagi Baa", artist: "Dr. Rajkumar", film: "Huliya Haalina Mevu", year: 1979, duration: "4:25", videoId: "5q0NamQM3Kk" },
  { id: "21", title: "Nannaseyaa Hoove", artist: "S. Janaki, Dr. Rajkumar", film: "Naa Ninna Mareyalaare", year: 1979, duration: "4:45", videoId: "50Em2GJq8pE" },
  { id: "22", title: "Jotheyage Hithavagi", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Rathasapthami", year: 1986, duration: "4:30", videoId: "9oVXKiHfcP4" },
  { id: "23", title: "Nagu Endhidhe", artist: "S. Janaki", film: "Pallavi Anu Pallavi", year: 1983, duration: "4:10", videoId: "5RuMpVFPMHQ" },
  { id: "24", title: "Naa Ninna Mareyalare (Duet)", artist: "Dr. Rajkumar, Vani Jairam", film: "Naa Ninna Mareyalaare", year: 1979, duration: "4:40", videoId: "FD3UN6dELZg" },
  { id: "25", title: "Bayasade Bali Bande", artist: "S. P. Balasubrahmanyam", film: "Gaali Maathu", year: 1981, duration: "4:20", videoId: "6iGxZReSRzI" },
  { id: "26", title: "Neenello", artist: "S. Janaki, Dr. Rajkumar", film: "Chelisuva Modagalu", year: 1982, duration: "4:50", videoId: "nxNha9W9dQw" },
  { id: "27", title: "Ninna Nanna", artist: "Dr. Rajkumar", film: "Dr. Rajkumar Special", year: 1980, duration: "4:15", videoId: "3Fp0tAhswRI" },
  { id: "28", title: "Notadage Nageya Meeti", artist: "S. P. Balasubrahmanyam", film: "Best Of S.P.B.", year: 1984, duration: "4:30", videoId: "71_Rt_2iNj0" },
  { id: "29", title: "Yaare Neenu Roja Hoove", artist: "S. P. Balasubrahmanyam", film: "Naanu Nanna Hendathi", year: 1985, duration: "4:45", videoId: "a8zRxwl0-3k" },
  { id: "30", title: "Aa Moda Bannalli", artist: "Vani Jairam, Bangalore Latha, Dr. Rajkumar", film: "Dhruva Thaare", year: 1985, duration: "4:20", videoId: "tQXtWqpcuGA" },
  { id: "31", title: "Ninade Nenapu Dinavu", artist: "P.B. Sreenivas", film: "Raja Nanna Raja", year: 1976, duration: "4:10", videoId: "1yulsPbvXlc" },
  { id: "32", title: "Sadaa Kannali", artist: "Vani Jairam, Dr. Rajkumar", film: "Kaviratna Kalidasa", year: 1983, duration: "4:35", videoId: "ANkhNKIM61A" },
  { id: "33", title: "Besuge Besuge", artist: "Vani Jairam, S. P. Balasubrahmanyam", film: "Besuge", year: 1976, duration: "4:25", videoId: "twNsAIkLj9M" },
  { id: "34", title: "Ravivarmana Kunchada Kale", artist: "P.B. Sreenivas", film: "Sose Thandha Sowbhaagya", year: 1977, duration: "4:15", videoId: "OWrHiwuqrzY" },
  { id: "35", title: "Ganga Yamuna", artist: "S. Janaki, Dr. Rajkumar", film: "Anuraga Aralithu", year: 1986, duration: "4:40", videoId: "Z0thGVE4aJw" },
  { id: "36", title: "Olidha Jeeva", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Benkiya Bale", year: 1983, duration: "4:30", videoId: "n5HxewSgNaU" },
  { id: "37", title: "Nanna Aase Hannage", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Auto Raja", year: 1980, duration: "4:25", videoId: "lsTCsgX_AKM" },
  { id: "38", title: "Alli Illi Noduve", artist: "S. Janaki, Dr. Rajkumar", film: "Operation Diamond Racket", year: 1978, duration: "4:15", videoId: "krz_MrcCf_Q" },
  { id: "39", title: "Neralanu Kaanada", artist: "S. P. Balasubrahmanyam", film: "Avala Hejje", year: 1981, duration: "4:35", videoId: "D0T1oNwPKOs" },
  { id: "40", title: "Endendu Ninnanu Maretu", artist: "Vani Jairam, P.B. Sreenivas", film: "Eradu Kanasu", year: 1974, duration: "4:20", videoId: "oB01cnveBIU" },
  { id: "41", title: "Thangaliyanthe", artist: "Rathna Mala Prakash, Dr. Rajkumar", film: "Guri", year: 1986, duration: "4:15", videoId: "Ja_uPaekDgY" },
  { id: "42", title: "Besuge Besuge (alt)", artist: "Vani Jairam, S. P. Balasubrahmanyam", film: "Besuge", year: 1976, duration: "4:25", videoId: "twNsAIkLj9M" },
  { id: "43", title: "Nooru Kannu Saladu", artist: "P.B. Sreenivas, S. P. Balasubrahmanyam", film: "Raja Nanna Raja", year: 1976, duration: "4:10", videoId: "EOk3WpSEp4M" },
  { id: "44", title: "Ninna Naguvu", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Benkiya Bale", year: 1983, duration: "4:30", videoId: "aykMi6gECBw" },
  { id: "45", title: "Koodi Balona", artist: "S. Janaki, Dr. Rajkumar, S. P. Balasubrahmanyam", film: "Giri Kanye", year: 1977, duration: "4:45", videoId: "27eD5JgbYxk" },
  { id: "46", title: "Harivarasanam Sharanam Ayyappa", artist: "K J Yesudas", film: "Swamy Ayyappaan", year: 1975, duration: "4:50", videoId: "3gqhhdszTqQ" },
  { id: "47", title: "Santhoshakke", artist: "S. P. Balasubrahmanyam", film: "Geetha", year: 1981, duration: "4:30", videoId: "neLfupVwObI" },
  { id: "48", title: "Naliva Gulabi Hoove", artist: "S. P. Balasubrahmanyam", film: "Auto Raja", year: 1980, duration: "4:25", videoId: "qrTvmCyGjvo" },
  { id: "49", title: "Jenina Holeyo", artist: "Dr. Rajkumar", film: "Chelisuva Modagalu", year: 1982, duration: "4:20", videoId: "EpwtGYuUzno" },
  { id: "50", title: "Bandeya Baalina", artist: "S. Janaki, S. P. Balasubrahmanyam", film: "Avala Hejje", year: 1981, duration: "4:35", videoId: "oX67i2CbgqM" }
];
