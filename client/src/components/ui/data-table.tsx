import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LucideChevronLeft, LucideChevronRight } from "lucide-react";

interface DataTableColumn<T> {
  header: string;
  accessorKey: keyof T | ((row: T) => React.ReactNode);
  cell?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  pageSize?: number;
  isLoading?: boolean;
  noDataMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  pageSize = 10,
  isLoading = false,
  noDataMessage = "Нет данных для отображения",
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  if (isLoading) {
    return (
      <div className="w-full">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(3)].map((_, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <div className="h-4 bg-muted animate-pulse rounded w-full max-w-[100px]"></div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentData = data.slice(startIndex, endIndex);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const renderCell = (row: T, column: DataTableColumn<T>) => {
    if (column.cell) {
      return column.cell(row);
    }

    if (typeof column.accessorKey === 'function') {
      return column.accessorKey(row);
    }

    return row[column.accessorKey] as React.ReactNode;
  };

  return (
    <div className="w-full">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column, index) => (
              <TableHead key={index}>{column.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {currentData.length > 0 ? (
            currentData.map((row, rowIndex) => (
              <TableRow key={rowIndex}>
                {columns.map((column, colIndex) => (
                  <TableCell key={colIndex}>
                    {renderCell(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-center py-6 text-muted-foreground">
                {noDataMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-between py-4">
          <div className="text-sm text-muted-foreground">
            Показано {startIndex + 1}-{Math.min(endIndex, data.length)} из {data.length} записей
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <LucideChevronLeft className="h-4 w-4" />
              <span className="sr-only">Предыдущая страница</span>
            </Button>
            {[...Array(totalPages)].map((_, index) => {
              const pageNumber = index + 1;
              // Show only current page and adjacent pages
              if (
                pageNumber === 1 ||
                pageNumber === totalPages ||
                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
              ) {
                return (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                );
              }
              
              // Show ellipsis for gaps
              if (
                (index === 1 && currentPage > 3) ||
                (index === totalPages - 2 && currentPage < totalPages - 2)
              ) {
                return (
                  <Button
                    key={`ellipsis-${index}`}
                    variant="outline"
                    size="sm"
                    disabled
                  >
                    ...
                  </Button>
                );
              }
              
              return null;
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <LucideChevronRight className="h-4 w-4" />
              <span className="sr-only">Следующая страница</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
