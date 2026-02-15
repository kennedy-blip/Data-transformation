# DataForge - Data Transformation & Export Tool

A powerful frontend-first application for uploading, transforming, and exporting datasets with ease. DataForge combines spreadsheet-like interactivity, real-time previews, and advanced export options to bridge the gap between raw data and actionable insights.

![DataForge Screenshot](https://via.placeholder.com/800x450?text=DataForge+Preview)

## 🚀 Features

### File Upload & Preview
- **Drag-and-drop support** for CSV, Excel (.xlsx, .xls), and JSON files
- **Auto-detect column types** (string, number, boolean, date)
- **Quick stats** showing missing values, unique values, and data ranges
- Interactive raw data table with virtual scrolling for large datasets

### Transformation Engine
- **Filtering**: Text search, ranges, equals, contains, starts/ends with, between values, isEmpty/isNotEmpty
- **Grouping & Aggregation**: Sum, mean, median, count, min, max
- **Pivot Table Builder**: Drag-and-drop interface for creating pivot tables
- **Multi-column Sorting**: Click column headers to sort

### Formula Builder
- Quick function buttons for common operations: SUM, AVG, LEN, IF, ROW()
- Apply formulas to create new computed columns
- Error validation with helpful messages

### Side-by-Side View
- **Raw vs Transformed**: Compare original and processed data
- Toggle between **Table View** and **Chart View**
- Color-coded changes highlighting differences

### Export Options
- Download as **CSV** or **Excel** (.xlsx)
- **SQL**: Generate CREATE TABLE and INSERT queries
- **Python/Pandas**: Export ready-to-use data processing scripts

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/dataforge.git
cd dataforge

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🏗️ Build

```bash
# Build for production
npm run build

# The output will be in the dist/ folder
```

## 🛠️ Tech Stack

- **React 19** - UI Framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **PapaParse** - CSV parsing
- **SheetJS (xlsx)** - Excel file handling
- **Recharts** - Data visualization
- **Lucide React** - Icons

## 📖 Usage

1. **Upload Data**: Drag and drop a file (CSV, Excel, or JSON) onto the dropzone
2. **Explore Data**: View the data table, column statistics, and data types
3. **Transform**: Apply filters, grouping, pivot tables, or formulas
4. **Compare**: Use side-by-side view to compare raw vs transformed data
5. **Export**: Download the result as CSV/Excel, SQL queries, or Python code

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

---

Made with ❤️ using React & Tailwind CSS
