package com.housie.repository;

import com.housie.model.CalledNumbers;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CalledNumbersRepository extends JpaRepository<CalledNumbers, Long> {
    List<CalledNumbers> findByRoomCodeOrderByCalledTimeAsc(String roomCode);
}
